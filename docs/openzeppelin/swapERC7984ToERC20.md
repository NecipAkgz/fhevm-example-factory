This example demonstrates how to swap between a confidential token - the ERC7984 and the ERC20 tokens using OpenZeppelin's smart contract library powered by ZAMA's FHEVM.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}
{% tabs %}

{% tab title="SwapERC7984ToERC20.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SwapERC7984ToERC20
 * @notice Swaps confidential ERC7984 tokens to regular ERC20 tokens.
 *
 * FHEVM v0.9 CHANGES:
 * - Uses FHE.makePubliclyDecryptable() + FHE.checkSignatures() instead of FHE.requestDecryption()
 * - Updated import paths for OpenZeppelin confidential contracts
 */
contract SwapERC7984ToERC20 is ZamaEthereumConfig {
    using SafeERC20 for IERC20;

    error SwapERC7984ToERC20InvalidSwap(euint64 encryptedAmount);

    struct PendingSwap {
        address receiver;
        bool pending;
    }

    mapping(euint64 => PendingSwap) private _pendingSwaps;
    IERC7984 private _fromToken;
    IERC20 private _toToken;

    event SwapInitiated(euint64 indexed encryptedAmount, address indexed receiver);
    event SwapFinalized(address indexed receiver, uint64 amount);

    constructor(IERC7984 fromToken, IERC20 toToken) {
        _fromToken = fromToken;
        _toToken = toToken;
    }

    /**
     * @notice Initiates a swap from ERC7984 to ERC20
     * @param encryptedInput The encrypted amount to swap
     * @param inputProof Proof for the encrypted input
     */
    function initiateSwap(externalEuint64 encryptedInput, bytes calldata inputProof) public {
        euint64 amount = FHE.fromExternal(encryptedInput, inputProof);
        FHE.allowTransient(amount, address(_fromToken));

        euint64 amountTransferred = _fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // FHEVM v0.9: Use makePubliclyDecryptable instead of requestDecryption
        FHE.makePubliclyDecryptable(amountTransferred);
        FHE.allowThis(amountTransferred);

        // Register pending swap
        _pendingSwaps[amountTransferred] = PendingSwap({
            receiver: msg.sender,
            pending: true
        });

        emit SwapInitiated(amountTransferred, msg.sender);
    }

    /**
     * @notice Finalizes a swap with a decryption proof
     * @param encryptedAmount The encrypted amount handle from initiateSwap
     * @param cleartextAmount The decrypted amount
     * @param decryptionProof Proof that cleartextAmount is the decryption of encryptedAmount
     */
    function finalizeSwap(
        euint64 encryptedAmount,
        uint64 cleartextAmount,
        bytes calldata decryptionProof
    ) public {
        PendingSwap storage pending = _pendingSwaps[encryptedAmount];
        require(pending.pending, SwapERC7984ToERC20InvalidSwap(encryptedAmount));

        // FHEVM v0.9: Verify decryption using checkSignatures
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint64.unwrap(encryptedAmount);
        FHE.checkSignatures(handles, abi.encode(cleartextAmount), decryptionProof);

        address receiver = pending.receiver;
        delete _pendingSwaps[encryptedAmount];

        if (cleartextAmount != 0) {
            _toToken.safeTransfer(receiver, cleartextAmount);
        }

        emit SwapFinalized(receiver, cleartextAmount);
    }
}
```

{% endtab %}

{% endtabs %}
