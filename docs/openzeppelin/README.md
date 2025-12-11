This section contains comprehensive guides and examples for using [OpenZeppelin's confidential smart contracts library](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts) with FHEVM. OpenZeppelin's confidential contracts library provides a secure, audited foundation for building privacy-preserving applications on fully homomorphic encryption (FHE) enabled blockchains.

The library includes implementations of popular standards like ERC7984, adapted for confidential computing with FHEVM, ensuring your applications maintain privacy while leveraging battle-tested security patterns.

## Getting Started

This guide will help you set up a development environment for working with OpenZeppelin's confidential contracts and FHEVM.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20
- **Hardhat** ^2.24
- **Access to an FHEVM-enabled network** and the Zama gateway/relayer

### Project Setup

1. **Clone the FHEVM Hardhat template repository:**

   ```bash
   git clone https://github.com/zama-ai/fhevm-hardhat-template conf-token
   cd conf-token
   ```

2. **Install project dependencies:**

   ```bash
   npm ci
   ```

3. **Install OpenZeppelin's confidential contracts library:**

   ```bash
   npm i @openzeppelin/confidential-contracts
   ```

4. **Compile the contracts:**

   ```bash
   npm run compile
   ```

5. **Run the test suite:**

   ```bash
   npm test
   ```

## FHEVM v0.9 API Changes

This documentation has been updated for FHEVM v0.9. Key changes include:

- **Solidity version**: `pragma solidity ^0.8.27`
- **Import paths**: Updated to match new OpenZeppelin Confidential Contracts structure
- **Decryption API**:
  - Old: `FHE.requestDecryption()` (deprecated)
  - New: `FHE.makePubliclyDecryptable()` + `FHE.checkSignatures()`
- **Config**: Use `ZamaEthereumConfig` for network configuration
