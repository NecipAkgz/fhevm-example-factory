This example demonstrates how to swap between two confidential ERC7984 tokens using OpenZeppelin's smart contract library powered by ZAMA's FHEVM.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}
{% tabs %}

{% tab title="SwapERC7984ToERC7984.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SwapERC7984ToERC7984
 * @notice Swaps between two confidential ERC7984 tokens.
 *
 * This contract demonstrates a fully confidential atomic swap where
 * both the input and output amounts remain encrypted.
 *
 * REQUIREMENTS:
 * - Caller must be an operator of fromToken for this contract
 * - This contract must hold sufficient toToken balance
 */
contract SwapERC7984ToERC7984 is ZamaEthereumConfig {
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
        require(fromToken.isOperator(msg.sender, address(this)), "Not authorized operator");

        euint64 amount = FHE.fromExternal(amountInput, inputProof);

        // Transfer from caller to this contract
        FHE.allowTransient(amount, address(fromToken));
        euint64 amountTransferred = fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // Transfer equivalent amount of toToken to caller
        FHE.allowTransient(amountTransferred, address(toToken));
        toToken.confidentialTransfer(msg.sender, amountTransferred);
    }
}

```

{% endtab %}

{% endtabs %}
