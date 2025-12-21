// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {
    Ownable2Step,
    Ownable
} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {
    ERC7984 as ERC7984Base
} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/**
 * @notice Confidential ERC20-compatible token using OpenZeppelin's ERC7984 standard.
 *         Implements a fully private token where balances and transfer amounts
 *         are encrypted. Compatible with standard ERC20 interfaces but with FHE
 *         under the hood. Supports both visible minting (owner knows amount) and
 *         confidential minting (fully private). Foundation for building private
 *         DeFi applications.
 *
 * @dev Demonstrates minting and burning with both visible and encrypted amounts.
 *      Shows how to integrate FHE with standard token operations.
 */
contract ERC7984Example is ZamaEthereumConfig, ERC7984Base, Ownable2Step {
    /// @notice Creates a new confidential ERC7984 token with initial supply
    /// @param owner Address that will own the token and receive initial supply
    /// @param amount Initial supply amount (visible on-chain but stored encrypted)
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param tokenURI_ Token metadata URI
    constructor(
        address owner,
        uint64 amount,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984Base(name_, symbol_, tokenURI_) Ownable(owner) {
        // 🔐 Mint initial supply as encrypted amount
        euint64 encryptedAmount = FHE.asEuint64(amount);
        _mint(owner, encryptedAmount);
    }

    // ==================== MINTING ====================

    /// @notice Mint with visible amount (owner knows the amount)
    /// @dev Amount is visible on-chain but stored encrypted
    function mint(address to, uint64 amount) external onlyOwner {
        _mint(to, FHE.asEuint64(amount));
    }

    /// @notice Mint with encrypted amount (full privacy)
    /// @dev Even the contract doesn't know the minted amount
    function confidentialMint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64 transferred) {
        return _mint(to, FHE.fromExternal(encryptedAmount, inputProof));
    }

    // ==================== BURNING ====================

    /// @notice Burn with visible amount
    function burn(address from, uint64 amount) external onlyOwner {
        _burn(from, FHE.asEuint64(amount));
    }

    /// @notice Burn with encrypted amount (full privacy)
    function confidentialBurn(
        address from,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64 transferred) {
        return _burn(from, FHE.fromExternal(encryptedAmount, inputProof));
    }

    // ==================== INTERNAL ====================

    /// @dev Grant owner access to total supply on every transfer
    function _update(
        address from,
        address to,
        euint64 amount
    ) internal virtual override returns (euint64 transferred) {
        transferred = super._update(from, to, amount);
        // Allow owner to decrypt total supply
        FHE.allow(confidentialTotalSupply(), owner());
    }
}
