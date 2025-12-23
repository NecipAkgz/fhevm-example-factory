// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint32,
    ebool,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Control flow anti-patterns in FHE development.
 *         Demonstrates common mistakes when using conditional logic
 *         and loops with encrypted values.
 *
 * @dev Covers 3 critical patterns: if/else branching, require statements,
 *      and encrypted loop iterations.
 *      Each shows ❌ WRONG and ✅ CORRECT implementations.
 */
contract FHEControlFlowAntiPatterns is ZamaEthereumConfig {
    euint32 private _secretBalance;
    euint32 private _threshold;
    ebool private _validationResult;

    /// @notice Initialize contract with encrypted balance (threshold fixed for simplicity)
    function initialize(
        externalEuint32 balance,
        bytes calldata inputProof
    ) external {
        _secretBalance = FHE.fromExternal(balance, inputProof);
        _threshold = FHE.asEuint32(100); // Fixed threshold for simpler testing

        FHE.allowThis(_secretBalance);
        FHE.allowThis(_threshold);
        FHE.allow(_secretBalance, msg.sender);
        FHE.allow(_threshold, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 1: If/Else Branching on Encrypted Values
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Using if/else with encrypted comparison
     * @dev This pattern leaks information through control flow
     */
    function wrongBranching() external returns (uint256) {
        // ❌ This would decrypt the comparison result!
        // The branch taken reveals encrypted information
        // if (decrypt(_secretBalance > _threshold)) {
        //     return 1;
        // }
        // return 0;

        // Placeholder to make function compile
        return 0;
    }

    /**
     * ✅ CORRECT: Use FHE.select for conditional logic
     * @dev All computation stays encrypted
     */
    function correctConditional() external {
        ebool isAboveThreshold = FHE.gt(_secretBalance, _threshold);

        // Apply penalty if above threshold, otherwise keep balance
        euint32 penaltyAmount = FHE.asEuint32(10);
        euint32 balanceMinusPenalty = FHE.sub(_secretBalance, penaltyAmount);

        _secretBalance = FHE.select(
            isAboveThreshold,
            balanceMinusPenalty,
            _secretBalance
        );

        FHE.allowThis(_secretBalance);
        FHE.allow(_secretBalance, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 2: Require/Revert with Encrypted Conditions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Cannot use require with encrypted boolean
     * @dev This doesn't compile - ebool cannot be used in require
     */
    function wrongRequire() external pure returns (string memory) {
        // ❌ COMPILE ERROR: require expects bool, not ebool
        // ebool hasEnough = FHE.ge(_secretBalance, FHE.asEuint32(100));
        // require(hasEnough, "Insufficient balance");

        return "This pattern doesn't work with encrypted values";
    }

    /**
     * ✅ CORRECT: Store encrypted boolean for client to check
     * @dev Let the client decrypt via getter and handle validation
     */
    function correctValidation() external {
        ebool hasEnough = FHE.ge(_secretBalance, FHE.asEuint32(100));

        _validationResult = hasEnough;
        FHE.allowThis(_validationResult);
        FHE.allow(_validationResult, msg.sender);
    }

    /// @notice Get validation result
    function getValidationResult() external view returns (ebool) {
        return _validationResult;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ANTI-PATTERN 3: Encrypted Loop Iterations
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ❌ WRONG: Loop count based on encrypted value
     * @dev Gas consumption reveals the loop count
     */
    function wrongEncryptedLoop() external pure returns (string memory) {
        // ❌ GAS LEAK: Number of iterations visible through gas cost!
        // for (uint i = 0; i < decrypt(_secretBalance); i++) {
        //     // Each iteration costs gas
        // }

        return "Loop iterations leak through gas consumption";
    }

    /**
     * ✅ CORRECT: Fixed iterations with FHE.select
     * @dev Always loop maximum times, conditionally apply operations
     */
    function correctFixedIterations() external {
        uint256 MAX_ITERATIONS = 5;
        euint32 result = FHE.asEuint32(0);

        for (uint256 i = 0; i < MAX_ITERATIONS; i++) {
            // Check if we should add (i < _secretBalance)
            ebool shouldAdd = FHE.lt(FHE.asEuint32(uint32(i)), _secretBalance);

            // Add 1 if condition true, 0 otherwise
            euint32 toAdd = FHE.select(
                shouldAdd,
                FHE.asEuint32(1),
                FHE.asEuint32(0)
            );
            result = FHE.add(result, toAdd);
        }

        FHE.allowThis(result);
        FHE.allow(result, msg.sender);
    }

    /// @notice Helper to get balance for testing
    function getBalance() external view returns (euint32) {
        return _secretBalance;
    }
}
