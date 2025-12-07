// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {
    ERC7984ERC20Wrapper as ERC7984ERC20WrapperBase,
    ERC7984
} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/**
 * @title ERC7984ERC20WrapperExample
 * @notice Wraps ERC20 tokens into confidential ERC7984 tokens
 *
 * @dev WRAP: ERC20 → ERC7984 (public → private)
 *      UNWRAP: ERC7984 → ERC20 (private → public, requires decryption)
 */
contract ERC7984ERC20WrapperExample is
    ERC7984ERC20WrapperBase,
    ZamaEthereumConfig
{
    constructor(
        IERC20 token,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984ERC20WrapperBase(token) ERC7984(name, symbol, uri) {}

    // 📦 Inherited from ERC7984ERC20Wrapper:
    //
    // wrap(address to, uint256 amount)
    //   - User approves this contract for ERC20
    //   - ERC20 is escrowed, ERC7984 is minted
    //
    // unwrap(address from, address to, euint64 amount)
    //   - ERC7984 is burned
    //   - Decryption is requested
    //   - After proof, ERC20 is released
}
