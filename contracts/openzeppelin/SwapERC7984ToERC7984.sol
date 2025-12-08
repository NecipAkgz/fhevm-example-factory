// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {
    IERC7984
} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Fully confidential swap between two ERC7984 tokens
 *
 * @dev Both input and output amounts remain encrypted
 */
contract SwapERC7984ToERC7984Example is ZamaEthereumConfig {
    /// @notice Swap confidential token for another confidential token
    /// @dev fromToken: The token to swap from
    ///      toToken: The token to receive
    ///      amountInput: Encrypted amount to swap
    ///      inputProof: Proof for the encrypted input
    function swapConfidentialForConfidential(
        IERC7984 fromToken,
        IERC7984 toToken,
        externalEuint64 amountInput,
        bytes calldata inputProof
    ) public virtual {
        // 🔍 Check caller is operator for this contract
        require(
            fromToken.isOperator(msg.sender, address(this)),
            "Not authorized operator"
        );

        euint64 amount = FHE.fromExternal(amountInput, inputProof);

        // 📥 Transfer fromToken: user → this contract
        FHE.allowTransient(amount, address(fromToken));
        euint64 amountTransferred = fromToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // 📤 Transfer toToken: this contract → user
        // Amount stays encrypted throughout!
        FHE.allowTransient(amountTransferred, address(toToken));
        toToken.confidentialTransfer(msg.sender, amountTransferred);
    }
}
