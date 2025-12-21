// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient with common mistakes.

 * @dev allow() = permanent, allowThis() = contract permission, allowTransient() = expires at TX end
 *      Both allowThis + allow required for user decryption!
 */
contract FHEAccessControl is ZamaEthereumConfig {
    euint32 private _secretValue;
    mapping(address => bool) public hasAccess;

    /// @notice ✅ CORRECT: Full access pattern for user decryption
    function storeWithFullAccess(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // Why BOTH allowThis + allow?
        // - allowThis: Contract authorizes "releasing" the encrypted value
        // - allow(user): User can request decryption for their key
        // Missing either = decryption fails!
        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);

        hasAccess[msg.sender] = true;
    }

    /// @notice Grant access to additional users
    function grantAccess(address user) external {
        require(hasAccess[msg.sender], "Caller has no access to grant");

        // Why this works: Contract already has allowThis from storeWithFullAccess
        // We only need to grant allow(user) for the new user
        FHE.allow(_secretValue, user);
        hasAccess[user] = true;
    }

    function getSecretValue() external view returns (euint32) {
        return _secretValue;
    }

    /// @notice ❌ WRONG: Missing allowThis → user decryption FAILS
    function storeWithoutAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Common mistake: Only allow(user) without allowThis
        // Result: User has permission but can't decrypt!
        // Why? Decryption needs contract to authorize the release
        FHE.allow(_secretValue, msg.sender);
    }

    /// @notice ❌ WRONG: Missing allow(user) → no one can decrypt
    function storeWithoutUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Another mistake: Only allowThis without allow(user)
        // Result: Contract can compute but no one can decrypt!
        FHE.allowThis(_secretValue);
    }

    /// @notice Temporary access - expires at end of transaction
    /// @dev ⚡ Gas: allowTransient ~50% cheaper than allow!
    ///      Use for passing values between contracts in same TX
    function computeAndShareTransient(
        address recipient
    ) external returns (euint32) {
        euint32 computed = FHE.add(_secretValue, FHE.asEuint32(1));

        // Why allowTransient instead of allow?
        // - Cheaper: ~50% less gas than permanent allow
        // - Auto-cleanup: Expires at TX end (no storage pollution)
        // - Use case: Passing values between contracts in same transaction
        FHE.allowTransient(computed, recipient);

        return computed;
    }
}
