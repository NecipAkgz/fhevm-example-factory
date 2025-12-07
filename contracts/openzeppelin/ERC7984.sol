// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {
    Ownable2Step,
    Ownable
} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {
    ERC7984 as ERC7984
} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/**
 * @title ConfidentialToken
 * @notice Confidential token using OpenZeppelin's ERC7984 standard.
 *
 * @dev This contract demonstrates:
 * - Extending OpenZeppelin's ERC7984 for confidential tokens
 * - Initial supply minting during deployment
 * - Basic mint/burn functionality with encrypted amounts
 *
 * KEY FEATURES:
 * - Encrypted balances via confidentialBalanceOf()
 * - Encrypted total supply via confidentialTotalSupply()
 * - Confidential transfers with operator support
 */
contract ERC7984Example is ZamaEthereumConfig, ERC7984, Ownable2Step {
    constructor(
        address owner,
        uint64 amount,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) Ownable(owner) {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        _mint(owner, encryptedAmount);
    }

    /**
     * @notice Mints tokens with a visible amount (for transparency)
     */
    function mint(address to, uint64 amount) external onlyOwner {
        _mint(to, FHE.asEuint64(amount));
    }

    /**
     * @notice Mints tokens with an encrypted amount (for privacy)
     */
    function confidentialMint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64 transferred) {
        return _mint(to, FHE.fromExternal(encryptedAmount, inputProof));
    }

    /**
     * @notice Burns tokens with a visible amount
     */
    function burn(address from, uint64 amount) external onlyOwner {
        _burn(from, FHE.asEuint64(amount));
    }

    /**
     * @notice Burns tokens with an encrypted amount
     */
    function confidentialBurn(
        address from,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64 transferred) {
        return _burn(from, FHE.fromExternal(encryptedAmount, inputProof));
    }

    /**
     * @dev Override to grant owner access to total supply
     */
    function _update(
        address from,
        address to,
        euint64 amount
    ) internal virtual override returns (euint64 transferred) {
        transferred = super._update(from, to, amount);
        FHE.allow(confidentialTotalSupply(), owner());
    }
}
