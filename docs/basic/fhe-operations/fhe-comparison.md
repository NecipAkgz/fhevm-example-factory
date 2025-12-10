Demonstrates all FHE comparison operations on encrypted integers

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FHEComparison.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    ebool,
    euint32,
    externalEuint32
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Demonstrates all FHE comparison operations on encrypted integers
 *
 * @dev This contract shows how to compare encrypted values without decrypting them.
 *      Comparison results are returned as encrypted booleans (ebool).
 *
 * Available operations:
 * - FHE.eq(a, b)   : Equal (a == b)
 * - FHE.ne(a, b)   : Not equal (a != b)
 * - FHE.gt(a, b)   : Greater than (a > b)
 * - FHE.lt(a, b)   : Less than (a < b)
 * - FHE.ge(a, b)   : Greater or equal (a >= b)
 * - FHE.le(a, b)   : Less or equal (a <= b)
 * - FHE.select(cond, a, b) : Conditional selection (cond ? a : b)
 */
contract FHEComparison is ZamaEthereumConfig {
    euint32 private _a;
    euint32 private _b;
    ebool private _boolResult;
    euint32 private _selectedResult;

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

    /// @notice Computes encrypted equality: result = (a == b)
    function computeEq() external {
        _boolResult = FHE.eq(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Computes encrypted inequality: result = (a != b)
    function computeNe() external {
        _boolResult = FHE.ne(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Computes encrypted greater than: result = (a > b)
    function computeGt() external {
        _boolResult = FHE.gt(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Computes encrypted less than: result = (a < b)
    function computeLt() external {
        _boolResult = FHE.lt(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Computes encrypted greater or equal: result = (a >= b)
    function computeGe() external {
        _boolResult = FHE.ge(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Computes encrypted less or equal: result = (a <= b)
    function computeLe() external {
        _boolResult = FHE.le(_a, _b);
        _grantBoolPermissions();
    }

    /// @notice Computes encrypted maximum using select: result = (a > b) ? a : b
    /// @dev Demonstrates FHE.select for conditional logic on encrypted values
    function computeMaxViaSelect() external {
        ebool aGtB = FHE.gt(_a, _b);
        _selectedResult = FHE.select(aGtB, _a, _b);
        FHE.allowThis(_selectedResult);
        FHE.allow(_selectedResult, msg.sender);
    }

    /// @notice Computes encrypted minimum using select: result = (a < b) ? a : b
    function computeMinViaSelect() external {
        ebool aLtB = FHE.lt(_a, _b);
        _selectedResult = FHE.select(aLtB, _a, _b);
        FHE.allowThis(_selectedResult);
        FHE.allow(_selectedResult, msg.sender);
    }

    /// @notice Returns the encrypted boolean result
    function getBoolResult() public view returns (ebool) {
        return _boolResult;
    }

    /// @notice Returns the encrypted selected result
    function getSelectedResult() public view returns (euint32) {
        return _selectedResult;
    }

    /// @dev Grants FHE permissions for boolean result
    function _grantBoolPermissions() internal {
        FHE.allowThis(_boolResult);
        FHE.allow(_boolResult, msg.sender);
    }
}

```

{% endtab %}

{% tab title="FHEComparison.ts" %}

```typescript
import { FhevmType, HardhatFhevmRuntimeEnvironment } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FHEComparison, FHEComparison__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEComparison")) as FHEComparison__factory;
  const contract = (await factory.deploy()) as FHEComparison;
  const contractAddress = await contract.getAddress();
  return { contract, contractAddress };
}

/**
 * @notice Demonstrates all FHE comparison operations on encrypted integers.
 * Tests: eq, ne, gt, lt, ge, le, select
 */
describe("FHEComparison", function () {
  let contract: FHEComparison;
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

  describe("Comparison Operations with A=100, B=25", function () {
    const valueA = 100;
    const valueB = 25;

    beforeEach(async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const inputA = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(valueA).encrypt();
      await contract.connect(signers.alice).setA(inputA.handles[0], inputA.inputProof);

      const inputB = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(valueB).encrypt();
      await contract.connect(signers.alice).setB(inputB.handles[0], inputB.inputProof);
    });

    it("should compute equality correctly (100 == 25 is false)", async function () {
      await contract.connect(signers.alice).computeEq();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(encrypted, contractAddress, signers.alice);
      expect(decrypted).to.equal(false);
    });

    it("should compute inequality correctly (100 != 25 is true)", async function () {
      await contract.connect(signers.alice).computeNe();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(encrypted, contractAddress, signers.alice);
      expect(decrypted).to.equal(true);
    });

    it("should compute greater than correctly (100 > 25 is true)", async function () {
      await contract.connect(signers.alice).computeGt();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(encrypted, contractAddress, signers.alice);
      expect(decrypted).to.equal(true);
    });

    it("should compute less than correctly (100 < 25 is false)", async function () {
      await contract.connect(signers.alice).computeLt();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(encrypted, contractAddress, signers.alice);
      expect(decrypted).to.equal(false);
    });

    it("should compute greater or equal correctly (100 >= 25 is true)", async function () {
      await contract.connect(signers.alice).computeGe();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(encrypted, contractAddress, signers.alice);
      expect(decrypted).to.equal(true);
    });

    it("should compute less or equal correctly (100 <= 25 is false)", async function () {
      await contract.connect(signers.alice).computeLe();
      const encrypted = await contract.getBoolResult();

      const decrypted = await hre.fhevm.userDecryptEbool(encrypted, contractAddress, signers.alice);
      expect(decrypted).to.equal(false);
    });

    it("should compute max via select correctly (max(100, 25) = 100)", async function () {
      await contract.connect(signers.alice).computeMaxViaSelect();
      const encrypted = await contract.getSelectedResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueA);
    });

    it("should compute min via select correctly (min(100, 25) = 25)", async function () {
      await contract.connect(signers.alice).computeMinViaSelect();
      const encrypted = await contract.getSelectedResult();

      const decrypted = await hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        encrypted,
        contractAddress,
        signers.alice,
      );
      expect(decrypted).to.equal(valueB);
    });
  });
});

```

{% endtab %}

{% endtabs %}
