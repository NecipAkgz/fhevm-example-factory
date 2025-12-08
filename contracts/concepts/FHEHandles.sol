// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Demonstrates FHE handle lifecycle: creation, computation, and storage
 *
 * @dev Handle = uint256 pointer to encrypted data stored by FHE coprocessor.
 *      Types: euint8/16/32/64/128/256, ebool, eaddress, ebytes64/128/256
 */
contract FHEHandles is ZamaEthereumConfig {
    // 🔐 Storage handles - persist across transactions
    // These are just uint256 pointers, actual ciphertext is off-chain
    euint32 private _storedValue;
    euint32 private _computedValue;

    event HandleCreated(string operation, uint256 gasUsed);
    event HandleStored(string description);

    constructor() {}

    // ==================== HANDLE CREATION ====================

    /// Pattern 1: Create handle from user's encrypted input
    function createFromExternal(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        uint256 gasBefore = gasleft();

        // 📥 FHE.fromExternal: converts external handle to internal handle
        // The proof is verified automatically
        _storedValue = FHE.fromExternal(input, inputProof);

        emit HandleCreated("fromExternal", gasBefore - gasleft());

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    /// Pattern 2: Create handle from plaintext constant
    /// @dev ⚠️ The plaintext IS visible on-chain! But result is encrypted.
    function createFromPlaintext(uint32 plaintextValue) external {
        uint256 gasBefore = gasleft();

        // 📥 FHE.asEuint32: encrypts a public constant
        // Use for: thresholds, comparison values, zero-initialization
        _storedValue = FHE.asEuint32(plaintextValue);

        emit HandleCreated("asEuint32", gasBefore - gasleft());

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    // ==================== HANDLE COMPUTATION ====================

    /// Key insight: FHE operations create NEW handles
    /// @dev Original handles are IMMUTABLE - they never change
    function computeNewHandle() external {
        uint256 gasBefore = gasleft();

        euint32 constant10 = FHE.asEuint32(10);

        // 🔄 FHE.add creates a BRAND NEW handle
        // _storedValue handle is UNCHANGED
        // _computedValue gets the NEW handle
        _computedValue = FHE.add(_storedValue, constant10);

        emit HandleCreated("add (new handle)", gasBefore - gasleft());

        // ⚠️ Must grant permissions for the NEW handle!
        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);

        emit HandleStored("Computed value stored with new handle");
    }

    /// Chained operations = multiple intermediate handles
    function chainedOperations() external {
        // 📝 Each operation creates a new handle:
        euint32 step1 = FHE.add(_storedValue, FHE.asEuint32(5)); // Handle #1
        euint32 step2 = FHE.mul(step1, FHE.asEuint32(2)); // Handle #2
        euint32 step3 = FHE.sub(step2, FHE.asEuint32(1)); // Handle #3

        _computedValue = step3;

        // Only final result needs permissions (if we're storing it)
        // Intermediate handles (step1, step2) have ephemeral permission
        // and are automatically cleaned up after transaction
        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);
    }

    // ==================== HANDLE IMMUTABILITY ====================

    /// Demonstrates: updating a variable creates NEW handle
    function demonstrateImmutability()
        external
        returns (euint32 original, euint32 updated)
    {
        // 📌 Save reference to current handle
        euint32 originalHandle = _storedValue;

        // 🔄 This creates NEW handle, assigns to _storedValue
        // originalHandle still points to OLD value!
        _storedValue = FHE.add(_storedValue, FHE.asEuint32(100));

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);

        // originalHandle → old value
        // _storedValue → new value (old + 100)
        return (originalHandle, _storedValue);
    }

    // ==================== GETTERS ====================

    function getStoredValue() external view returns (euint32) {
        return _storedValue;
    }

    function getComputedValue() external view returns (euint32) {
        return _computedValue;
    }
}
