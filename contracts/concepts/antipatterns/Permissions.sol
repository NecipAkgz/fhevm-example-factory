// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Permission management anti-patterns in FHE development.
 *         Covers mistakes with allowThis, allow, and permission propagation
 *         across transfers and cross-contract calls.
 *
 * @dev Explores missing permissions, view function failures, and delegation issues.
 */
contract FHEPermissionsAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretValue;
    mapping(address => euint32) private _balances;

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 1: Missing allowThis After Computation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Compute but forget allowThis
     * @dev Result exists but contract can't use it in future operations
     */
    function wrongMissingAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);
        euint32 doubled = FHE.mul(_secretValue, FHE.asEuint32(2));
        _secretValue = doubled;

        // ❌ Missing FHE.allowThis! Contract can't use this value later
        FHE.allow(_secretValue, msg.sender);
    }

    /**
     * ✅ CORRECT: Always grant allowThis after computation
     * @dev Contract needs permission to use encrypted values
     */
    function correctWithAllowThis(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);
        euint32 doubled = FHE.mul(_secretValue, FHE.asEuint32(2));
        _secretValue = doubled;

        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 2: Missing allow(user)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Only allowThis without user permission
     * @dev No one can decrypt the value
     */
    function wrongMissingUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Contract can compute but no one can decrypt!
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Grant both allowThis and allow(user)
     * @dev User can decrypt after contract operations
     */
    function correctWithUserAllow(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 3: View Function Without Permissions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Store value without granting permission to caller
     * @dev When caller tries to get value via view, they can't decrypt it
     */
    function wrongStoreWithoutPermission(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        // ❌ Only allowThis, caller has no permission!
        FHE.allowThis(_secretValue);
    }

    /**
     * ✅ CORRECT: Grant permission to caller when storing
     * @dev Caller can now decrypt value returned from view function
     */
    function correctStoreWithPermission(
        externalEuint32 input,
        bytes calldata inputProof
    ) external {
        _secretValue = FHE.fromExternal(input, inputProof);

        FHE.allowThis(_secretValue);
        FHE.allow(_secretValue, msg.sender); // ✅ Grant permission!
    }

    /// @notice View function to get stored value
    function getValue() external view returns (euint32) {
        return _secretValue;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 4: Unauthenticated Re-encryption
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Re-encrypt without verifying public key ownership
     * @dev Anyone can provide any public key and steal encrypted data
     */
    function wrongReencryptWithoutAuth(
        bytes32 publicKey
    ) external view returns (bytes memory) {
        // ❌ SECURITY RISK: No verification that caller owns this public key!
        // Attacker can provide victim's public key and get their data

        // This would allow impersonation attacks:
        // return Gateway.reencrypt(_secretValue, publicKey);

        return ""; // Placeholder
    }

    /**
     * ✅ CORRECT: Use FHEVM's built-in authentication
     * @dev fhevm.js SDK verifies EIP-712 signature automatically
     *      Only the owner of the public key can decrypt
     */
    function correctReencryptWithAuth() external view returns (euint32) {
        // ✅ Return handle directly
        // Client uses fhevm.instance.reencrypt() which:
        // 1. Signs request with their private key (EIP-712)
        // 2. Gateway verifies signature matches public key
        // 3. Only then re-encrypts for that public key

        return _secretValue;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 5: Transfer Without Permission Propagation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize balance for msg.sender
     * @dev Required before using transfer functions
     */
    function initializeBalance(
        externalEuint32 initialBalance,
        bytes calldata inputProof
    ) external {
        _balances[msg.sender] = FHE.fromExternal(initialBalance, inputProof);
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
    }

    /**
     * ❌ WRONG: Transfer without granting permissions
     * @dev Recipient gets balance but can't use or decrypt it
     */
    function wrongTransferWithoutPermission(
        address recipient,
        externalEuint32 amount,
        bytes calldata inputProof
    ) external {
        euint32 transferAmount = FHE.fromExternal(amount, inputProof);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], transferAmount);
        _balances[recipient] = FHE.add(_balances[recipient], transferAmount);

        // ❌ Recipient has no permission to use their new balance!
    }

    /**
     * ✅ CORRECT: Grant permissions after transfer
     * @dev Both parties can use and decrypt their updated balances
     */
    function correctTransferWithPermission(
        address recipient,
        externalEuint32 amount,
        bytes calldata inputProof
    ) external {
        euint32 transferAmount = FHE.fromExternal(amount, inputProof);

        _balances[msg.sender] = FHE.sub(_balances[msg.sender], transferAmount);
        _balances[recipient] = FHE.add(_balances[recipient], transferAmount);

        // ✅ Grant permissions to both parties
        FHE.allowThis(_balances[msg.sender]);
        FHE.allow(_balances[msg.sender], msg.sender);
        FHE.allowThis(_balances[recipient]);
        FHE.allow(_balances[recipient], recipient);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 6: Cross-Contract Permission Delegation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Call another contract without granting permission
     * @dev Other contract can't use the encrypted value
     */
    function wrongCrossContractCall(address processor) external returns (bool) {
        // ❌ processor contract has no permission to use _secretValue!
        // This call will fail or return garbage
        (bool success, ) = processor.call(
            abi.encodeWithSignature("process(uint256)", _secretValue)
        );
        return success;
    }

    /**
     * ✅ CORRECT: Grant temporary permission before cross-contract call
     * @dev Use allowTransient for gas-efficient temporary access
     */
    function correctCrossContractCall(
        address processor
    ) external returns (bool) {
        // ✅ Grant temporary permission (expires at end of transaction)
        FHE.allowTransient(_secretValue, processor);

        // Now processor can use _secretValue in this transaction
        (bool success, ) = processor.call(
            abi.encodeWithSignature("process(uint256)", _secretValue)
        );

        return success;
    }

    /// @notice Helper to get balance for testing
    function getBalance(address user) external view returns (euint32) {
        return _balances[user];
    }
}
