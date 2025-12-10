Demonstrates all FHE arithmetic operations on encrypted integers

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEArithmetic.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Demonstrates all FHE arithmetic operations on encrypted integers
 *
 * @dev This contract shows how to perform mathematical operations on encrypted values
 *      without ever revealing the underlying data.
 *
 * Available operations:
 * - FHE.add(a, b)  : Addition
 * - FHE.sub(a, b)  : Subtraction
 * - FHE.mul(a, b)  : Multiplication
 * - FHE.div(a, b)  : Division (integer)
 * - FHE.rem(a, b)  : Remainder (modulo)
 * - FHE.min(a, b)  : Minimum of two values
 * - FHE.max(a, b)  : Maximum of two values
 */
contract FHEArithmetic is ZamaEthereumConfig {
    euint32 private _a;
    euint32 private _b;
    euint32 private _result;

    // solhint-disable-next-line no-empty-blocks
    constructor() {}

    /// @notice Sets the first operand (encrypted)
    function setA(externalEuint32 inputA, bytes calldata inputProof) external {
        _a = FHE.fromExternal(inputA, inputProof);
        FHE.allowThis(_a);
    }

    /// @notice Sets the second operand (encrypted)
    function setB(externalEuint32 inputB, bytes calldata inputProof) external {
        _b = FHE.fromExternal(inputB, inputProof);
        FHE.allowThis(_b);
    }

    /// @notice Computes encrypted addition: result = a + b
    function computeAdd() external {
        _result = FHE.add(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted subtraction: result = a - b
    /// @dev No underflow protection - in production, add range checks
    function computeSub() external {
        _result = FHE.sub(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted multiplication: result = a * b
    /// @dev No overflow protection - in production, add range checks
    function computeMul() external {
        _result = FHE.mul(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted division: result = a / b (scalar)
    /// @dev Divisor must be a scalar (plaintext) because FHE division by encrypted value is not supported.
    function computeDiv(uint32 divisor) external {
        _result = FHE.div(_a, divisor);
        _grantPermissions();
    }

    /// @notice Computes encrypted remainder: result = a % b (scalar)
    /// @dev Divisor must be a scalar (plaintext).
    function computeRem(uint32 modulus) external {
        _result = FHE.rem(_a, modulus);
        _grantPermissions();
    }

    /// @notice Computes encrypted minimum: result = min(a, b)
    function computeMin() external {
        _result = FHE.min(_a, _b);
        _grantPermissions();
    }

    /// @notice Computes encrypted maximum: result = max(a, b)
    function computeMax() external {
        _result = FHE.max(_a, _b);
        _grantPermissions();
    }

    /// @notice Returns the encrypted result
    /// @dev Caller must have FHE permissions to decrypt
    function getResult() public view returns (euint32) {
        return _result;
    }

    /// @dev Grants FHE permissions to contract and caller for decryption
    function _grantPermissions() internal {
        FHE.allowThis(_result);
        FHE.allow(_result, msg.sender);
    }
}

```

{% endtab %}

{% tab title="FHEArithmetic.ts" %}

```typescript
import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEArithmetic, FHEArithmetic__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEArithmetic")) as FHEArithmetic__factory;
  const contract = (await factory.deploy()) as FHEArithmetic;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Demonstrates all FHE arithmetic operations on encrypted integers.
 * Tests: add, sub, mul, div, rem, min, max
 */
describe("FHEArithmetic", function () {
  let contract: FHEArithmetic;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.contractAddress;
    contract = deployment.contract;
  });

  describe("Arithmetic Operations", function () {
    const valueA = 100;
    const valueB = 25;

    beforeEach(async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Set encrypted values A and B
      const inputA = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(valueA).encrypt();
      await contract.connect(signers.alice).setA(inputA.handles[0], inputA.inputProof);

      const inputB = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(valueB).encrypt();
      await contract.connect(signers.alice).setB(inputB.handles[0], inputB.inputProof);
    });

    it("should compute addition correctly (100 + 25 = 125)", async function () {
      await contract.connect(signers.alice).computeAdd();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA + valueB);
    });

    it("should compute subtraction correctly (100 - 25 = 75)", async function () {
      await contract.connect(signers.alice).computeSub();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA - valueB);
    });

    it("should compute multiplication correctly (100 * 25 = 2500)", async function () {
      await contract.connect(signers.alice).computeMul();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA * valueB);
    });

    it("should compute division correctly (100 / 25 = 4)", async function () {
      await contract.connect(signers.alice).computeDiv(valueB);
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(Math.floor(valueA / valueB));
    });

    it("should compute remainder correctly (100 % 25 = 0)", async function () {
      await contract.connect(signers.alice).computeRem(valueB);
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA % valueB);
    });

    it("should compute minimum correctly (min(100, 25) = 25)", async function () {
      await contract.connect(signers.alice).computeMin();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(Math.min(valueA, valueB));
    });

    it("should compute maximum correctly (max(100, 25) = 100)", async function () {
      await contract.connect(signers.alice).computeMax();
      const encrypted = await contract.getResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(Math.max(valueA, valueB));
    });
  });
});

```

{% endtab %}

{% endtabs %}
