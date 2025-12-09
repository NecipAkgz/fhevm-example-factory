/**
 * Shared configuration for FHEVM examples
 *
 * This configuration is used by the CLI to provide available examples and categories
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
    "fhe-counter": {
        contract: "contracts/basic/FHECounter.sol",
        test: "test/basic/FHECounter.ts",
        description: "Confidential counter implementation using FHEVM, compared with a standard counter to highlight encryption benefits.",
        category: "Basic",
        title: "FHE Counter",
    },
    "encrypt-single-value": {
        contract: "contracts/basic/encrypt/EncryptSingleValue.sol",
        test: "test/basic/encrypt/EncryptSingleValue.ts",
        description: "FHE encryption mechanism with single values, including common pitfalls and best practices for developers.",
        category: "Basic - Encryption",
        title: "Encrypt Single Value",
    },
    "encrypt-multiple-values": {
        contract: "contracts/basic/encrypt/EncryptMultipleValues.sol",
        test: "test/basic/encrypt/EncryptMultipleValues.ts",
        description: "Encrypting and handling multiple values in a single transaction efficiently.",
        category: "Basic - Encryption",
        title: "Encrypt Multiple Values",
    },
    "user-decrypt-single-value": {
        contract: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
        test: "test/basic/decrypt/UserDecryptSingleValue.ts",
        description: "FHE user decryption mechanism for single values, with common pitfalls and correct implementation patterns.",
        category: "Basic - Decryption",
        title: "User Decrypt Single Value",
    },
    "user-decrypt-multiple-values": {
        contract: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
        test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
        description: "Decrypting multiple encrypted values for a user in a single operation.",
        category: "Basic - Decryption",
        title: "User Decrypt Multiple Values",
    },
    "public-decrypt-single-value": {
        contract: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
        test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
        description: "Publicly decrypting a single encrypted value on-chain for transparent results.",
        category: "Basic - Decryption",
        title: "Public Decrypt Single Value",
    },
    "public-decrypt-multiple-values": {
        contract: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
        test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
        description: "Publicly decrypting multiple encrypted values in a single transaction for batch transparency.",
        category: "Basic - Decryption",
        title: "Public Decrypt Multiple Values",
    },
    "fhe-add": {
        contract: "contracts/basic/fhe-operations/FHEAdd.sol",
        test: "test/basic/fhe-operations/FHEAdd.ts",
        description: "Addition operations on encrypted values using FHE.add() for homomorphic computation.",
        category: "FHE Operations",
        title: "FHE Add Operation",
    },
    "fhe-if-then-else": {
        contract: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
        test: "test/basic/fhe-operations/FHEIfThenElse.ts",
        description: "Conditional operations on encrypted values using FHE.select() for encrypted branching logic.",
        category: "FHE Operations",
        title: "FHE If-Then-Else",
    },
    "fhe-arithmetic": {
        contract: "contracts/basic/fhe-operations/FHEArithmetic.sol",
        test: "test/basic/fhe-operations/FHEArithmetic.ts",
        description: "Comprehensive example demonstrating all FHE arithmetic operations: add, sub, mul, div, rem, min, max.",
        category: "FHE Operations",
        title: "FHE Arithmetic Operations",
    },
    "fhe-comparison": {
        contract: "contracts/basic/fhe-operations/FHEComparison.sol",
        test: "test/basic/fhe-operations/FHEComparison.ts",
        description: "Demonstrates all FHE comparison operations: eq, ne, gt, lt, ge, le, and the select function for encrypted conditionals.",
        category: "FHE Operations",
        title: "FHE Comparison Operations",
    },
    "fhe-access-control": {
        contract: "contracts/concepts/FHEAccessControl.sol",
        test: "test/concepts/FHEAccessControl.ts",
        description: "Critical access control patterns in FHEVM: FHE.allow, FHE.allowThis, FHE.allowTransient. Includes common mistakes and correct implementations.",
        category: "Concepts",
        title: "FHE Access Control",
    },
    "fhe-input-proof": {
        contract: "contracts/concepts/FHEInputProof.sol",
        test: "test/concepts/FHEInputProof.ts",
        description: "Explains input proof validation in FHEVM: what proofs are, why they are needed, and how to use them correctly with single and batched inputs.",
        category: "Concepts",
        title: "FHE Input Proofs",
    },
    "fhe-handles": {
        contract: "contracts/concepts/FHEHandles.sol",
        test: "test/concepts/FHEHandles.ts",
        description: "Understanding FHE handles: creation, computation, immutability, and symbolic execution in mock mode.",
        category: "Concepts",
        title: "FHE Handles & Lifecycle",
    },
    "fhe-anti-patterns": {
        contract: "contracts/concepts/FHEAntiPatterns.sol",
        test: "test/concepts/FHEAntiPatterns.ts",
        description: "Common FHE mistakes and their correct alternatives. Covers: branching, permissions, require/revert, re-encryption, loops, noise, and deprecated APIs.",
        category: "Concepts",
        title: "FHE Anti-Patterns",
    },
    erc7984: {
        contract: "contracts/openzeppelin/ERC7984.sol",
        test: "test/openzeppelin/ERC7984.ts",
        description: "Confidential token (ERC7984) with mint/burn functionality using OpenZeppelin's library powered by ZAMA's FHEVM.",
        category: "OpenZeppelin",
        title: "ERC7984 Tutorial",
    },
    "erc7984-erc20-wrapper": {
        contract: "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
        test: "test/openzeppelin/ERC7984ERC20Wrapper.ts",
        description: "Wrapping standard ERC20 tokens into confidential ERC7984 tokens to enable privacy for any existing ERC20.",
        category: "OpenZeppelin",
        title: "ERC7984 to ERC20 Wrapper",
    },
    "swap-erc7984-to-erc20": {
        contract: "contracts/openzeppelin/SwapERC7984ToERC20.sol",
        test: "test/openzeppelin/SwapERC7984ToERC20.ts",
        description: "Swapping between confidential ERC7984 and ERC20 tokens using the new v0.9 decryption API (makePubliclyDecryptable + checkSignatures).",
        category: "OpenZeppelin",
        title: "Swap ERC7984 to ERC20",
    },
    "swap-erc7984-to-erc7984": {
        contract: "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
        test: "test/openzeppelin/SwapERC7984ToERC7984.ts",
        description: "Fully confidential atomic swap between two ERC7984 tokens where both input and output amounts remain encrypted.",
        category: "OpenZeppelin",
        title: "Swap ERC7984 to ERC7984",
    },
    "vesting-wallet": {
        contract: "contracts/openzeppelin/VestingWallet.sol",
        test: "test/openzeppelin/VestingWallet.ts",
        description: "Linear vesting wallet for ERC7984 tokens where vested amounts remain encrypted for privacy.",
        category: "OpenZeppelin",
        title: "Vesting Wallet",
    },
    "blind-auction": {
        contract: "contracts/advanced/BlindAuction.sol",
        test: "test/advanced/BlindAuction.ts",
        description: "Encrypted blind auction where bids remain confidential. Uses FHE.gt() and FHE.select() to find the winner without revealing losing bids.",
        category: "Advanced",
        title: "Blind Auction",
    },
    "hidden-voting": {
        contract: "contracts/advanced/HiddenVoting.sol",
        test: "test/advanced/HiddenVoting.ts",
        description: "Encrypted voting mechanism with homomorphic tallying. Individual votes remain private forever while final counts are revealed.",
        category: "Advanced",
        title: "Hidden Voting",
    },
};
// =============================================================================
// Category Configurations
// =============================================================================
export const CATEGORIES = {
    basic: {
        name: "Basic FHEVM Examples",
        description: "Fundamental FHEVM operations including encryption, decryption, and basic FHE operations",
        contracts: [
            {
                sol: "contracts/basic/FHECounter.sol",
                test: "test/basic/FHECounter.ts",
            },
            {
                sol: "contracts/basic/encrypt/EncryptSingleValue.sol",
                test: "test/basic/encrypt/EncryptSingleValue.ts",
            },
            {
                sol: "contracts/basic/encrypt/EncryptMultipleValues.sol",
                test: "test/basic/encrypt/EncryptMultipleValues.ts",
            },
            {
                sol: "contracts/basic/decrypt/UserDecryptSingleValue.sol",
                test: "test/basic/decrypt/UserDecryptSingleValue.ts",
            },
            {
                sol: "contracts/basic/decrypt/UserDecryptMultipleValues.sol",
                test: "test/basic/decrypt/UserDecryptMultipleValues.ts",
            },
            {
                sol: "contracts/basic/decrypt/PublicDecryptSingleValue.sol",
                test: "test/basic/decrypt/PublicDecryptSingleValue.ts",
            },
            {
                sol: "contracts/basic/decrypt/PublicDecryptMultipleValues.sol",
                test: "test/basic/decrypt/PublicDecryptMultipleValues.ts",
            },
            {
                sol: "contracts/basic/fhe-operations/FHEAdd.sol",
                test: "test/basic/fhe-operations/FHEAdd.ts",
            },
            {
                sol: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
                test: "test/basic/fhe-operations/FHEIfThenElse.ts",
            },
        ],
    },
    concepts: {
        name: "Critical Concepts",
        description: "Access control, input proofs, handles, and anti-patterns",
        contracts: [
            {
                sol: "contracts/concepts/FHEAccessControl.sol",
                test: "test/concepts/FHEAccessControl.ts",
            },
            {
                sol: "contracts/concepts/FHEInputProof.sol",
                test: "test/concepts/FHEInputProof.ts",
            },
            {
                sol: "contracts/concepts/FHEHandles.sol",
                test: "test/concepts/FHEHandles.ts",
            },
            {
                sol: "contracts/concepts/FHEAntiPatterns.sol",
                test: "test/concepts/FHEAntiPatterns.ts",
            },
        ],
    },
    operations: {
        name: "FHE Operations",
        description: "Arithmetic, comparison, and conditional operations",
        contracts: [
            {
                sol: "contracts/basic/fhe-operations/FHEAdd.sol",
                test: "test/basic/fhe-operations/FHEAdd.ts",
            },
            {
                sol: "contracts/basic/fhe-operations/FHEArithmetic.sol",
                test: "test/basic/fhe-operations/FHEArithmetic.ts",
            },
            {
                sol: "contracts/basic/fhe-operations/FHEComparison.sol",
                test: "test/basic/fhe-operations/FHEComparison.ts",
            },
            {
                sol: "contracts/basic/fhe-operations/FHEIfThenElse.sol",
                test: "test/basic/fhe-operations/FHEIfThenElse.ts",
            },
        ],
    },
    openzeppelin: {
        name: "OpenZeppelin Confidential Contracts",
        description: "ERC7984 confidential token standard, wrappers, swaps, and vesting",
        contracts: [
            {
                sol: "contracts/openzeppelin/ERC7984.sol",
                test: "test/openzeppelin/ERC7984.ts",
            },
            {
                sol: "contracts/openzeppelin/ERC7984ERC20Wrapper.sol",
                test: "test/openzeppelin/ERC7984ERC20Wrapper.ts",
            },
            {
                sol: "contracts/openzeppelin/SwapERC7984ToERC20.sol",
                test: "test/openzeppelin/SwapERC7984ToERC20.ts",
            },
            {
                sol: "contracts/openzeppelin/SwapERC7984ToERC7984.sol",
                test: "test/openzeppelin/SwapERC7984ToERC7984.ts",
            },
            {
                sol: "contracts/openzeppelin/VestingWallet.sol",
                test: "test/openzeppelin/VestingWallet.ts",
            },
        ],
    },
    advanced: {
        name: "Advanced Examples",
        description: "Complex FHE applications: blind auctions, encrypted voting systems",
        contracts: [
            {
                sol: "contracts/advanced/BlindAuction.sol",
                test: "test/advanced/BlindAuction.ts",
            },
            {
                sol: "contracts/advanced/HiddenVoting.sol",
                test: "test/advanced/HiddenVoting.ts",
            },
        ],
    },
};
//# sourceMappingURL=config.js.map