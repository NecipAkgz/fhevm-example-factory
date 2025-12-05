// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEAccessControl
 * @notice Demonstrates FHE access control patterns - the most critical concept in FHEVM.
 *
 * @dev WHY ACCESS CONTROL MATTERS:
 * In FHEVM, encrypted values (handles) are stored on-chain but can only be decrypted
 * by authorized parties. Without proper permissions, even the contract owner cannot
 * decrypt stored values.
 *
 * KEY CONCEPTS:
 *
 * 1. FHE.allow(handle, address)
 *    - Grants PERMANENT permission to an address to decrypt a handle
 *    - Persists in storage, survives transaction end
 *    - Use for: stored values that users need to decrypt later
 *
 * 2. FHE.allowThis(handle)
 *    - Grants permission to the contract itself
 *    - REQUIRED for the contract to operate on the handle in future transactions
 *    - REQUIRED for users to perform "user decryption" (reencryption)
 *
 * 3. FHE.allowTransient(handle, address)
 *    - Grants TEMPORARY permission that expires at end of transaction
 *    - More gas efficient than permanent allow
 *    - Use for: intermediate values passed between contracts in same tx
 *
 * COMMON MISTAKE:
 * Forgetting FHE.allowThis() prevents user decryption even if FHE.allow(user) was called!
 */
contract FHEAccessControl is ZamaEthereumConfig {
    euint32 private _secretValue;

    /// @notice Mapping to track who has been granted access
    mapping(address => bool) public hasAccess;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    // ========== CORRECT PATTERNS ==========

    /**
     * @notice CORRECT: Stores value with proper permissions for both contract and caller
     * @dev Both allowThis AND allow are needed for user decryption to work
     */
    function storeWithFullAccess(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ✅ Grant contract permission - needed for future operations AND user decryption
        FHE.allowThis(_secretValue);

        // ✅ Grant caller permission - enables them to decrypt
        FHE.allow(_secretValue, msg.sender);

        hasAccess[msg.sender] = true;
    }

    /**
     * @notice Grants access to an additional user
     * @dev Only works because contract has permission via allowThis
     */
    function grantAccess(address user) external {
        require(hasAccess[msg.sender], "Caller has no access to grant");

        // ✅ Contract can grant access because it has allowThis permission
        FHE.allow(_secretValue, user);
        hasAccess[user] = true;
    }

    /**
     * @notice Returns the encrypted value for authorized decryption
     * @dev Caller must have been granted access via allow()
     */
    function getSecretValue() external view returns (euint32) {
        return _secretValue;
    }

    // ========== WRONG PATTERNS (FOR EDUCATION) ==========

    /**
     * @notice WRONG: Missing allowThis - user decryption will FAIL
     * @dev Even though we call allow(msg.sender), user decryption requires
     *      BOTH the contract AND the user to have permissions
     */
    function storeWithoutAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Missing FHE.allowThis(_secretValue) - user decryption will fail!
        FHE.allow(_secretValue, msg.sender);
    }

    /**
     * @notice WRONG: Missing allow(user) - user cannot decrypt
     * @dev Contract can operate on value, but no user can decrypt
     */
    function storeWithoutUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        // ❌ Missing FHE.allow(_secretValue, msg.sender) - no one can decrypt!
    }

    // ========== TRANSIENT ACCESS PATTERN ==========

    /**
     * @notice Demonstrates allowTransient for temporary access within a transaction
     * @dev Useful when passing encrypted values between contracts
     * @param recipient Contract or address that needs temporary access
     */
    function computeAndShareTransient(
        address recipient
    ) external returns (euint32) {
        // Perform some computation
        euint32 computed = FHE.add(_secretValue, FHE.asEuint32(1));

        // Grant temporary access - cheaper than permanent, expires after tx
        FHE.allowTransient(computed, recipient);

        return computed;
    }
}
