// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Deep dive into FHE handles: uint256 pointers to encrypted data.
 *         Demonstrates handle creation (fromExternal, asEuint, operations) and
 *         emphasizes their immutability—each operation creates a NEW handle.
 *
 * @dev Handles are immutable uint256 pointers. Operations always yield new handles.
 */
contract FHEHandles is ZamaEthereumConfig {
    euint32 private _storedValue;
    euint32 private _computedValue;

    event HandleCreated(string operation, uint256 gasUsed);
    event HandleStored(string description);

    /// @notice Pattern 1: Create handle from user's encrypted input
    function createFromExternal(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        uint256 gasBefore = gasleft();

        // fromExternal: validates proof and creates internal handle
        _storedValue = FHE.fromExternal(input, inputProof);

        emit HandleCreated("fromExternal", gasBefore - gasleft());

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    /// @notice Pattern 2: Create handle from plaintext constant
    /// @dev ⚠️ The plaintext IS visible on-chain! But result is encrypted.
    function createFromPlaintext(uint32 plaintextValue) external {
        uint256 gasBefore = gasleft();

        // asEuint32: encrypts a public constant (visible on-chain!)
        _storedValue = FHE.asEuint32(plaintextValue);

        emit HandleCreated("asEuint32", gasBefore - gasleft());

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);
    }

    /// @notice ⚠️ Key insight: FHE operations create NEW handles (immutable!)
    function computeNewHandle() external {
        uint256 gasBefore = gasleft();

        euint32 constant10 = FHE.asEuint32(10);

        // 🔄 Why NEW handle? FHE values are immutable - operations always create new ones
        _computedValue = FHE.add(_storedValue, constant10);

        emit HandleCreated("add (new handle)", gasBefore - gasleft());

        // Must grant permissions for NEW handle
        FHE.allowThis(_computedValue);
        FHE.allow(_computedValue, msg.sender);

        emit HandleStored("Computed value stored with new handle");
    }

    /// @notice Chained operations = multiple intermediate handles
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

    /// @notice Demonstrates: updating variable creates NEW handle
    function demonstrateImmutability()
        external
        returns (euint32 original, euint32 updated)
    {
        euint32 originalHandle = _storedValue;

        // This creates NEW handle! originalHandle still points to OLD value
        _storedValue = FHE.add(_storedValue, FHE.asEuint32(100));

        FHE.allowThis(_storedValue);
        FHE.allow(_storedValue, msg.sender);

        // originalHandle → old value
        // _storedValue → new value (old + 100)
        return (originalHandle, _storedValue);
    }

    function getStoredValue() external view returns (euint32) {
        return _storedValue;
    }

    function getComputedValue() external view returns (euint32) {
        return _computedValue;
    }
}
