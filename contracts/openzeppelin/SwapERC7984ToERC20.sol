// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    IERC7984
} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Swap confidential ERC7984 tokens to regular ERC20 tokens
 *
 * @dev Uses FHEVM v0.9 decryption:
 *      FHE.makePubliclyDecryptable() + FHE.checkSignatures()
 */
contract SwapERC7984ToERC20Example is ZamaEthereumConfig {
    using SafeERC20 for IERC20;

    error InvalidSwap(euint64 encryptedAmount);

    struct PendingSwap {
        address receiver;
        bool pending;
    }

    mapping(euint64 => PendingSwap) private _pendingSwaps;
    IERC7984 private _fromToken;
    IERC20 private _toToken;

    event SwapInitiated(
        euint64 indexed encryptedAmount,
        address indexed receiver
    );
    event SwapFinalized(address indexed receiver, uint64 amount);

    constructor(IERC7984 fromToken, IERC20 toToken) {
        _fromToken = fromToken;
        _toToken = toToken;
    }

    // ==================== STEP 1: INITIATE ====================

    /// @notice Start the swap - transfers ERC7984 and requests decryption
    function initiateSwap(
        externalEuint64 encryptedInput,
        bytes calldata inputProof
    ) public {
        euint64 amount = FHE.fromExternal(encryptedInput, inputProof);

        // Transfer ERC7984 from user to this contract
        FHE.allowTransient(amount, address(_fromToken));
        euint64 amountTransferred = _fromToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // 🔓 FHEVM v0.9: Request public decryption
        // KMS will provide proof that this value decrypts to X
        FHE.makePubliclyDecryptable(amountTransferred);
        FHE.allowThis(amountTransferred);

        // Register pending swap
        _pendingSwaps[amountTransferred] = PendingSwap({
            receiver: msg.sender,
            pending: true
        });

        emit SwapInitiated(amountTransferred, msg.sender);
    }

    // ==================== STEP 2: FINALIZE ====================

    /// @notice Complete the swap with decryption proof from KMS
    /// @dev encryptedAmount: The handle from initiateSwap
    ///      cleartextAmount: The decrypted value
    ///      decryptionProof: Proof from KMS that decryption is valid
    function finalizeSwap(
        euint64 encryptedAmount,
        uint64 cleartextAmount,
        bytes calldata decryptionProof
    ) public {
        PendingSwap storage pending = _pendingSwaps[encryptedAmount];
        require(pending.pending, InvalidSwap(encryptedAmount));

        // 🔐 FHEVM v0.9: Verify decryption proof
        // This ensures cleartextAmount is the TRUE decryption of encryptedAmount
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(encryptedAmount);
        FHE.checkSignatures(
            handles,
            abi.encode(cleartextAmount),
            decryptionProof
        );

        address receiver = pending.receiver;
        delete _pendingSwaps[encryptedAmount];

        // Release ERC20 to user
        if (cleartextAmount != 0) {
            _toToken.safeTransfer(receiver, cleartextAmount);
        }

        emit SwapFinalized(receiver, cleartextAmount);
    }
}
