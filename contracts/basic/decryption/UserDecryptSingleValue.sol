// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice User-controlled decryption with mandatory two-step permissions.
 *         Demonstrates the pattern: allowThis() for contract storage/computation
 *         and allow() for user decryption, illustrating correct vs incorrect usage.
 *
 * @dev Both allowThis and allow are required for successful user decryption.
 */
contract UserDecryptSingleValue is ZamaEthereumConfig {
    euint32 private _trivialEuint32;

    /// @notice ✅ CORRECT: Proper permission pattern
    function initializeUint32(uint32 value) external {
        _trivialEuint32 = FHE.add(FHE.asEuint32(value), FHE.asEuint32(1));

        // 🔑 Why both needed?
        // - allowThis: Contract authorizes releasing the value
        // - allow: User can request decryption
        FHE.allowThis(_trivialEuint32);
        FHE.allow(_trivialEuint32, msg.sender);
    }

    /// @notice ❌ WRONG: Missing allowThis causes decryption to FAIL!
    /// @dev Common mistake - user gets permission but decryption still fails
    function initializeUint32Wrong(uint32 value) external {
        _trivialEuint32 = FHE.add(FHE.asEuint32(value), FHE.asEuint32(1));

        // ❌ Missing allowThis → user can't decrypt!
        // Why? Decryption needs contract authorization to release
        FHE.allow(_trivialEuint32, msg.sender);
    }

    function encryptedUint32() public view returns (euint32) {
        return _trivialEuint32;
    }
}
