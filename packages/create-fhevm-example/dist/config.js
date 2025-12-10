/**
 * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY ⚠️
 *
 * This file is auto-generated from scripts/shared/config.ts
 * Run 'npm run sync:config' to update it.
 *
 * Source: scripts/shared/config.ts
 */
// =============================================================================
// GitHub Repository Configuration
// =============================================================================
export const REPO_URL = "https://github.com/NecipAkgz/fhevm-example-factory";
export const REPO_BRANCH = "main";
export const TEMPLATE_SUBMODULE_PATH = "fhevm-hardhat-template";
// =============================================================================
// Example Configurations
// =============================================================================
export const EXAMPLES = {
    "blind-auction": {
        "contract": "contracts/advanced/BlindAuction.sol",
        "test": "test/advanced/BlindAuction.ts",
        "description": "Blind Auction with encrypted bids - only the winning price is revealed",
        "category": "Advanced",
        "title": "Blind Auction"
    },
    "hidden-voting": {
        "contract": "contracts/advanced/HiddenVoting.sol",
        "test": "test/advanced/HiddenVoting.ts",
        "description": "Hidden Voting with encrypted ballots and homomorphic tallying",
        "category": "Advanced",
        "title": "Hidden Voting"
    },
    "fhe-counter": {
        "contract": "contracts/basic/FHECounter.sol",
        "test": "test/basic/FHECounter.ts",
        "description": "Confidential counter implementation using FHEVM, compared with a standard counter to highlight encryption benefits.",
        "category": "Basic",
        "title": "FHE Counter"
    },
    "public-decrypt-multiple-values": {
        "contract": "contracts/basic/decryption/PublicDecryptMultipleValues.sol",
        "test": "test/basic/decryption/PublicDecryptMultipleValues.ts",
        "description": "Implements a simple 8-sided Die Roll game demonstrating public, permissionless decryption",
        "category": "Basic - Decryption",
        "title": "Public Decrypt Multiple Values"
    },
    "public-decrypt-single-value": {
        "contract": "contracts/basic/decryption/PublicDecryptSingleValue.sol",
        "test": "test/basic/decryption/PublicDecryptSingleValue.ts",
        "description": "Implements a simple Heads or Tails game demonstrating public, permissionless decryption",
        "category": "Basic - Decryption",
        "title": "Public Decrypt Single Value"
    },
    "user-decrypt-multiple-values": {
        "contract": "contracts/basic/decryption/UserDecryptMultipleValues.sol",
        "test": "test/basic/decryption/UserDecryptMultipleValues.ts",
        "description": "Demonstrates user decryption of multiple encrypted values",
        "category": "Basic - Decryption",
        "title": "User Decrypt Multiple Values"
    },
    "user-decrypt-single-value": {
        "contract": "contracts/basic/decryption/UserDecryptSingleValue.sol",
        "test": "test/basic/decryption/UserDecryptSingleValue.ts",
        "description": "Demonstrates the FHE decryption mechanism and highlights common pitfalls",
        "category": "Basic - Decryption",
        "title": "User Decrypt Single Value"
    },
    "encrypt-multiple-values": {
        "contract": "contracts/basic/encryption/EncryptMultipleValues.sol",
        "test": "test/basic/encryption/EncryptMultipleValues.ts",
        "description": "Encrypting and handling multiple values in a single transaction efficiently.",
        "category": "Basic - Encryption",
        "title": "Encrypt Multiple Values"
    },
    "encrypt-single-value": {
        "contract": "contracts/basic/encryption/EncryptSingleValue.sol",
        "test": "test/basic/encryption/EncryptSingleValue.ts",
        "description": "FHE encryption mechanism with single values, including common pitfalls and best practices for developers.",
        "category": "Basic - Encryption",
        "title": "Encrypt Single Value"
    },
    "fhe-add": {
        "contract": "contracts/basic/fhe-operations/FHEAdd.sol",
        "test": "test/basic/fhe-operations/FHEAdd.ts",
        "description": "Simple example: adding two encrypted values (a + b)",
        "category": "Basic - FHE Operations",
        "title": "FHE Add"
    },
    "fhe-arithmetic": {
        "contract": "contracts/basic/fhe-operations/FHEArithmetic.sol",
        "test": "test/basic/fhe-operations/FHEArithmetic.ts",
        "description": "Demonstrates all FHE arithmetic operations on encrypted integers",
        "category": "Basic - FHE Operations",
        "title": "FHE Arithmetic"
    },
    "fhe-comparison": {
        "contract": "contracts/basic/fhe-operations/FHEComparison.sol",
        "test": "test/basic/fhe-operations/FHEComparison.ts",
        "description": "Demonstrates all FHE comparison operations on encrypted integers",
        "category": "Basic - FHE Operations",
        "title": "FHE Comparison"
    },
    "fhe-if-then-else": {
        "contract": "contracts/basic/fhe-operations/FHEIfThenElse.sol",
        "test": "test/basic/fhe-operations/FHEIfThenElse.ts",
        "description": "Demonstrates conditional logic: max(a, b) using encrypted comparison",
        "category": "Basic - FHE Operations",
        "title": "FHE If Then Else"
    },
    "fhe-access-control": {
        "contract": "contracts/concepts/FHEAccessControl.sol",
        "test": "test/concepts/FHEAccessControl.ts",
        "description": "Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.",
        "category": "Concepts",
        "title": "FHE Access Control"
    },
    "fhe-anti-patterns": {
        "contract": "contracts/concepts/FHEAntiPatterns.sol",
        "test": "test/concepts/FHEAntiPatterns.ts",
        "description": "Common FHE mistakes and their correct alternatives. Covers: branching, permissions, require/revert, re-encryption, loops, noise, and deprecated APIs.",
        "category": "Concepts",
        "title": "FHE Anti Patterns"
    },
    "fhe-handles": {
        "contract": "contracts/concepts/FHEHandles.sol",
        "test": "test/concepts/FHEHandles.ts",
        "description": "Understanding FHE handles: creation, computation, immutability, and symbolic execution in mock mode.",
        "category": "Concepts",
        "title": "FHE Handles"
    },
    "fhe-input-proof": {
        "contract": "contracts/concepts/FHEInputProof.sol",
        "test": "test/concepts/FHEInputProof.ts",
        "description": "Explains input proof validation in FHEVM: what proofs are, why they are needed, and how to use them correctly with single and batched inputs.",
        "category": "Concepts",
        "title": "FHE Input Proof"
    },
    "erc7984": {
        "contract": "contracts/openzeppelin/ERC7984.sol",
        "test": "test/openzeppelin/ERC7984.ts",
        "description": "Confidential token using OpenZeppelin's ERC7984 standard",
        "category": "Openzeppelin",
        "title": "ERC7984"
    },
    "erc7984-erc20-wrapper": {
        "contract": "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
        "test": "test/openzeppelin/ERC7984ERC20Wrapper.ts",
        "description": "Wraps ERC20 tokens into confidential ERC7984 tokens",
        "category": "Openzeppelin",
        "title": "ERC7984 ERC20 Wrapper"
    },
    "swap-erc7984-to-erc20": {
        "contract": "contracts/openzeppelin/SwapERC7984ToERC20.sol",
        "test": "test/openzeppelin/SwapERC7984ToERC20.ts",
        "description": "Swap confidential ERC7984 tokens to regular ERC20 tokens",
        "category": "Openzeppelin",
        "title": "Swap ERC7984 To ERC20"
    },
    "swap-erc7984-to-erc7984": {
        "contract": "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
        "test": "test/openzeppelin/SwapERC7984ToERC7984.ts",
        "description": "Fully confidential swap between two ERC7984 tokens",
        "category": "Openzeppelin",
        "title": "Swap ERC7984 To ERC7984"
    },
    "vesting-wallet": {
        "contract": "contracts/openzeppelin/VestingWallet.sol",
        "test": "test/openzeppelin/VestingWallet.ts",
        "description": "Linear vesting wallet for ERC7984 tokens - amounts stay encrypted!",
        "category": "Openzeppelin",
        "title": "Vesting Wallet"
    }
};
// =============================================================================
// Category Configurations
// =============================================================================
export const CATEGORIES = {
    "advanced": {
        "name": "Advanced Examples",
        "description": "Complex FHE applications: blind auctions, encrypted voting systems",
        "contracts": [
            {
                "sol": "contracts/advanced/BlindAuction.sol",
                "test": "test/advanced/BlindAuction.ts"
            },
            {
                "sol": "contracts/advanced/HiddenVoting.sol",
                "test": "test/advanced/HiddenVoting.ts"
            }
        ]
    },
    "basic": {
        "name": "Basic Examples",
        "description": "Fundamental FHEVM operations including encryption, decryption, and basic FHE operations",
        "contracts": [
            {
                "sol": "contracts/basic/FHECounter.sol",
                "test": "test/basic/FHECounter.ts"
            }
        ]
    },
    "basicdecryption": {
        "name": "Basic - Decryption Examples",
        "description": "User and public decryption patterns for encrypted values",
        "contracts": [
            {
                "sol": "contracts/basic/decryption/PublicDecryptMultipleValues.sol",
                "test": "test/basic/decryption/PublicDecryptMultipleValues.ts"
            },
            {
                "sol": "contracts/basic/decryption/PublicDecryptSingleValue.sol",
                "test": "test/basic/decryption/PublicDecryptSingleValue.ts"
            },
            {
                "sol": "contracts/basic/decryption/UserDecryptMultipleValues.sol",
                "test": "test/basic/decryption/UserDecryptMultipleValues.ts"
            },
            {
                "sol": "contracts/basic/decryption/UserDecryptSingleValue.sol",
                "test": "test/basic/decryption/UserDecryptSingleValue.ts"
            }
        ]
    },
    "basicencryption": {
        "name": "Basic - Encryption Examples",
        "description": "Encrypting values and handling encrypted inputs",
        "contracts": [
            {
                "sol": "contracts/basic/encryption/EncryptMultipleValues.sol",
                "test": "test/basic/encryption/EncryptMultipleValues.ts"
            },
            {
                "sol": "contracts/basic/encryption/EncryptSingleValue.sol",
                "test": "test/basic/encryption/EncryptSingleValue.ts"
            }
        ]
    },
    "basicfheoperations": {
        "name": "Basic - FHE Operations Examples",
        "description": "Basic - FHE Operations examples and implementations",
        "contracts": [
            {
                "sol": "contracts/basic/fhe-operations/FHEAdd.sol",
                "test": "test/basic/fhe-operations/FHEAdd.ts"
            },
            {
                "sol": "contracts/basic/fhe-operations/FHEArithmetic.sol",
                "test": "test/basic/fhe-operations/FHEArithmetic.ts"
            },
            {
                "sol": "contracts/basic/fhe-operations/FHEComparison.sol",
                "test": "test/basic/fhe-operations/FHEComparison.ts"
            },
            {
                "sol": "contracts/basic/fhe-operations/FHEIfThenElse.sol",
                "test": "test/basic/fhe-operations/FHEIfThenElse.ts"
            }
        ]
    },
    "concepts": {
        "name": "Concepts Examples",
        "description": "Access control, input proofs, handles, and anti-patterns",
        "contracts": [
            {
                "sol": "contracts/concepts/FHEAccessControl.sol",
                "test": "test/concepts/FHEAccessControl.ts"
            },
            {
                "sol": "contracts/concepts/FHEAntiPatterns.sol",
                "test": "test/concepts/FHEAntiPatterns.ts"
            },
            {
                "sol": "contracts/concepts/FHEHandles.sol",
                "test": "test/concepts/FHEHandles.ts"
            },
            {
                "sol": "contracts/concepts/FHEInputProof.sol",
                "test": "test/concepts/FHEInputProof.ts"
            }
        ]
    },
    "openzeppelin": {
        "name": "Openzeppelin Examples",
        "description": "ERC7984 confidential token standard, wrappers, swaps, and vesting",
        "contracts": [
            {
                "sol": "contracts/openzeppelin/ERC7984.sol",
                "test": "test/openzeppelin/ERC7984.ts"
            },
            {
                "sol": "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
                "test": "test/openzeppelin/ERC7984ERC20Wrapper.ts"
            },
            {
                "sol": "contracts/openzeppelin/SwapERC7984ToERC20.sol",
                "test": "test/openzeppelin/SwapERC7984ToERC20.ts"
            },
            {
                "sol": "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
                "test": "test/openzeppelin/SwapERC7984ToERC7984.ts"
            },
            {
                "sol": "contracts/openzeppelin/VestingWallet.sol",
                "test": "test/openzeppelin/VestingWallet.ts"
            }
        ]
    }
};
//# sourceMappingURL=config.js.map