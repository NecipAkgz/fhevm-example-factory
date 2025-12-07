// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    ERC7984ERC20Wrapper as ERC7984ERC20Wrapper,
    ERC7984
} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/**
 * @title ConfidentialWrapper
 * @notice Wraps a standard ERC20 token into a confidential ERC7984 token.
 *
 * @dev This contract demonstrates:
 * - Converting between public ERC20 and private ERC7984 tokens
 * - Handling decimal differences between standards
 *
 * KEY OPERATIONS:
 *
 * WRAP (ERC20 → ERC7984):
 * - User approves this contract to spend their ERC20
 * - User calls wrap(to, amount)
 * - ERC20 is held in escrow, ERC7984 is minted
 *
 * UNWRAP (ERC7984 → ERC20):
 * - User calls unwrap(from, to, amount)
 * - ERC7984 is burned, initiates decryption
 * - After decryption proof, ERC20 is released
 *
 * USE CASES:
 * - Privacy layer for stablecoins
 * - Confidential DeFi protocols
 * - Private payroll systems
 */
contract ERC7984ERC20WrapperExample is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    constructor(
        IERC20 token,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984ERC20Wrapper(token) ERC7984(name, symbol, uri) {}
}
