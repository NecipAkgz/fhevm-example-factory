// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {
    IERC7984
} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SwapERC7984ToERC7984Example
 * @notice Swaps between two confidential ERC7984 tokens.
 *
 * @dev This contract demonstrates:
 * - Fully confidential atomic swap
 * - Both input and output amounts remain encrypted
 *
 * FLOW:
 * 1. User calls swap with encrypted amount
 * 2. FromToken is transferred to contract
 * 3. ToToken is transferred to user
 *
 * REQUIREMENTS:
 * - Caller must be an operator of fromToken for this contract
 * - This contract must hold sufficient toToken balance
 */
contract SwapERC7984ToERC7984Example is ZamaEthereumConfig {
    /**
     * @notice Swaps confidential token for another confidential token
     * @param fromToken The token to swap from
     * @param toToken The token to receive
     * @param amountInput Encrypted amount to swap
     * @param inputProof Proof for the encrypted input
     */
    function swapConfidentialForConfidential(
        IERC7984 fromToken,
        IERC7984 toToken,
        externalEuint64 amountInput,
        bytes calldata inputProof
    ) public virtual {
        // Verify caller is an operator for this contract
        require(
            fromToken.isOperator(msg.sender, address(this)),
            "Not authorized operator"
        );

        euint64 amount = FHE.fromExternal(amountInput, inputProof);

        // Transfer from caller to this contract
        FHE.allowTransient(amount, address(fromToken));
        euint64 amountTransferred = fromToken.confidentialTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        // Transfer equivalent amount of toToken to caller
        FHE.allowTransient(amountTransferred, address(toToken));
        toToken.confidentialTransfer(msg.sender, amountTransferred);
    }
}
