Confidential payroll system with encrypted salaries. Employers can add employees with encrypted salary amounts. Each employee can decrypt only their own salary - other salaries remain hidden. Demonstrates selective decryption permissions where different users see different encrypted values. Perfect for privacy-preserving HR systems.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (11 items)</summary>

**Types:** `ebool` · `euint64` · `externalEuint64`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint64()` - Encrypts a plaintext uint64 value into euint64
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.sub()` - Homomorphic subtraction: result = a - b (underflow wraps)
- `FHE.toBytes32()` - Converts encrypted handle to bytes32 for proof arrays

</details>

{% tabs %}

{% tab title="PrivatePayroll.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint64,
    ebool,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Confidential payroll system with encrypted salaries.
 *         Employers can add employees with encrypted salary amounts. Each employee
 *         can decrypt only their own salary - other salaries remain hidden.
 *         Demonstrates selective decryption permissions where different users
 *         see different encrypted values. Perfect for privacy-preserving HR systems.
 *
 * @dev Flow: addEmployee() → fund() → processPayment()
 *      Each employee can decrypt only their own salary.
 */
contract PrivatePayroll is ZamaEthereumConfig {
    address public employer;

    /// List of employee addresses
    address[] public employees;

    /// Mapping from employee to their encrypted salary
    mapping(address => euint64) private _salaries;

    /// Whether an address is an employee
    mapping(address => bool) public isEmployee;

    /// Last payment timestamp per employee
    mapping(address => uint256) public lastPayment;

    /// Total encrypted salary sum (for budget tracking)
    euint64 private _totalSalaries;

    /// Payment period in seconds (default: 30 days)
    uint256 public paymentPeriod;

    /// Emitted when a new employee is added
    /// @param employee Address of the employee
    event EmployeeAdded(address indexed employee);

    /// @notice Emitted when an employee is removed
    /// @param employee Address of the removed employee
    event EmployeeRemoved(address indexed employee);

    /// @notice Emitted when salary is updated
    /// @param employee Address of the employee
    event SalaryUpdated(address indexed employee);

    /// @notice Emitted when payment is processed
    /// @param employee Address of paid employee
    /// @param timestamp Payment time
    event PaymentProcessed(address indexed employee, uint256 timestamp);

    /// @notice Emitted when contract is funded
    /// @param amount Amount funded
    event ContractFunded(uint256 amount);

    modifier onlyEmployer() {
        require(msg.sender == employer, "Only employer");
        _;
    }

    modifier onlyEmployee() {
        require(isEmployee[msg.sender], "Not an employee");
        _;
    }

    constructor(uint256 _paymentPeriod) {
        employer = msg.sender;
        paymentPeriod = _paymentPeriod > 0 ? _paymentPeriod : 30 days;
        _totalSalaries = FHE.asEuint64(0);
        FHE.allowThis(_totalSalaries);
    }

    /// @notice Add a new employee with encrypted salary
    /// @param employee Address of the employee
    /// @param encryptedSalary Encrypted salary amount
    /// @param inputProof Proof validating the encrypted input
    function addEmployee(
        address employee,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof
    ) external onlyEmployer {
        require(employee != address(0), "Invalid address");
        require(!isEmployee[employee], "Already an employee");

        // 🔐 Convert external encrypted input
        euint64 salary = FHE.fromExternal(encryptedSalary, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(salary);
        FHE.allow(salary, employee); // Employee can view their own salary

        // 📋 Store employee data
        _salaries[employee] = salary;
        isEmployee[employee] = true;
        employees.push(employee);

        // 📊 Update total
        _totalSalaries = FHE.add(_totalSalaries, salary);
        FHE.allowThis(_totalSalaries);

        emit EmployeeAdded(employee);
    }

    /// @notice Update an employee's salary
    /// @param employee Address of the employee
    /// @param encryptedSalary New encrypted salary amount
    /// @param inputProof Proof validating the encrypted input
    function updateSalary(
        address employee,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof
    ) external onlyEmployer {
        require(isEmployee[employee], "Not an employee");

        // Get old salary for total adjustment
        euint64 oldSalary = _salaries[employee];

        // 🔐 Convert new salary
        euint64 newSalary = FHE.fromExternal(encryptedSalary, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(newSalary);
        FHE.allow(newSalary, employee);

        // 📋 Update salary
        _salaries[employee] = newSalary;

        // 📊 Update total: subtract old, add new
        _totalSalaries = FHE.sub(_totalSalaries, oldSalary);
        _totalSalaries = FHE.add(_totalSalaries, newSalary);
        FHE.allowThis(_totalSalaries);

        emit SalaryUpdated(employee);
    }

    /// @notice Remove an employee
    /// @param employee Address to remove
    function removeEmployee(address employee) external onlyEmployer {
        require(isEmployee[employee], "Not an employee");

        // Get salary for total adjustment
        euint64 salary = _salaries[employee];

        // 📊 Update total
        _totalSalaries = FHE.sub(_totalSalaries, salary);
        FHE.allowThis(_totalSalaries);

        // Remove from list
        for (uint256 i = 0; i < employees.length; i++) {
            if (employees[i] == employee) {
                employees[i] = employees[employees.length - 1];
                employees.pop();
                break;
            }
        }

        // Clear data - euint64 cannot use delete, assign to zero instead
        _salaries[employee] = FHE.asEuint64(0);
        isEmployee[employee] = false;
        lastPayment[employee] = 0;

        emit EmployeeRemoved(employee);
    }

    /// @notice Fund the contract for payroll
    function fund() external payable onlyEmployer {
        require(msg.value > 0, "Must send funds");
        emit ContractFunded(msg.value);
    }

    /// @notice Process payment for a single employee
    /// @dev Requires decryption of salary - simplified for demo
    /// @param employee Address to pay
    /// @param abiEncodedSalary ABI-encoded salary amount
    /// @param decryptionProof KMS decryption proof
    function processPayment(
        address employee,
        bytes memory abiEncodedSalary,
        bytes memory decryptionProof
    ) external onlyEmployer {
        require(isEmployee[employee], "Not an employee");
        require(
            block.timestamp >= lastPayment[employee] + paymentPeriod,
            "Too early for next payment"
        );

        // Verify decryption
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(_salaries[employee]);
        FHE.checkSignatures(cts, abiEncodedSalary, decryptionProof);

        uint64 salaryAmount = abi.decode(abiEncodedSalary, (uint64));
        require(address(this).balance >= salaryAmount, "Insufficient funds");

        lastPayment[employee] = block.timestamp;

        // Transfer salary
        (bool sent, ) = employee.call{value: salaryAmount}("");
        require(sent, "Payment failed");

        emit PaymentProcessed(employee, block.timestamp);
    }

    /// @notice Get encrypted salary handle for employee
    /// @dev Only callable by the employee themselves
    function getMySalary() external view onlyEmployee returns (euint64) {
        return _salaries[msg.sender];
    }

    /// @notice Get encrypted total salaries handle
    /// @dev Only employer can access for budget planning
    function getTotalSalaries() external view onlyEmployer returns (euint64) {
        return _totalSalaries;
    }

    /// @notice Get number of employees
    function getEmployeeCount() external view returns (uint256) {
        return employees.length;
    }

    /// @notice Get employee at index
    function getEmployee(uint256 index) external view returns (address) {
        require(index < employees.length, "Index out of bounds");
        return employees[index];
    }

    /// @notice Check if payment is due for an employee
    function isPaymentDue(address employee) external view returns (bool) {
        if (!isEmployee[employee]) return false;
        return block.timestamp >= lastPayment[employee] + paymentPeriod;
    }

    /// @notice Get contract balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get payroll info
    function getPayrollInfo()
        external
        view
        returns (uint256 employeeCount, uint256 balance, uint256 period)
    {
        return (employees.length, address(this).balance, paymentPeriod);
    }

    /// @notice Accept ETH deposits
    receive() external payable {
        emit ContractFunded(msg.value);
    }
}

```

{% endtab %}

{% tab title="PrivatePayroll.ts" %}

```typescript
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PrivatePayroll, PrivatePayroll__factory } from "../types";
import { expect } from "chai";

type Signers = {
  employer: HardhatEthersSigner;
  employee1: HardhatEthersSigner;
  employee2: HardhatEthersSigner;
};

const PAYMENT_PERIOD = 86400; // 1 day for testing

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "PrivatePayroll"
  )) as PrivatePayroll__factory;
  const payroll = (await factory.deploy(PAYMENT_PERIOD)) as PrivatePayroll;
  const payrollAddress = await payroll.getAddress();

  return { payroll, payrollAddress };
}

/**
 * Private Payroll Tests
 *
 * Tests confidential salary management and FHE-based payment processing.
 */
describe("PrivatePayroll", function () {
  let signers: Signers;
  let payroll: PrivatePayroll;
  let payrollAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      employer: ethSigners[0],
      employee1: ethSigners[1],
      employee2: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ payroll, payrollAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await payroll.employer()).to.equal(signers.employer.address);
      expect(await payroll.paymentPeriod()).to.equal(BigInt(PAYMENT_PERIOD));
      expect(await payroll.getEmployeeCount()).to.equal(0n);
    });

    it("should default to 30 days if zero period provided", async function () {
      const factory = await ethers.getContractFactory("PrivatePayroll");
      const payroll30 = await factory.deploy(0);
      expect(await payroll30.paymentPeriod()).to.equal(30n * 24n * 60n * 60n);
    });
  });

  describe("Employee Management", function () {
    it("should add employee with encrypted salary", async function () {
      const salary = 5000n;

      const encryptedSalary = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(salary)
        .encrypt();

      await expect(
        payroll.addEmployee(
          signers.employee1.address,
          encryptedSalary.handles[0],
          encryptedSalary.inputProof
        )
      )
        .to.emit(payroll, "EmployeeAdded")
        .withArgs(signers.employee1.address);

      expect(await payroll.isEmployee(signers.employee1.address)).to.be.true;
      expect(await payroll.getEmployeeCount()).to.equal(1n);
    });

    it("should prevent adding duplicate employee", async function () {
      const enc1 = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(5000n)
        .encrypt();

      await payroll.addEmployee(
        signers.employee1.address,
        enc1.handles[0],
        enc1.inputProof
      );

      const enc2 = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(6000n)
        .encrypt();

      await expect(
        payroll.addEmployee(
          signers.employee1.address,
          enc2.handles[0],
          enc2.inputProof
        )
      ).to.be.revertedWith("Already an employee");
    });

    it("should remove employee correctly", async function () {
      const enc = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(5000n)
        .encrypt();

      await payroll.addEmployee(
        signers.employee1.address,
        enc.handles[0],
        enc.inputProof
      );

      await expect(payroll.removeEmployee(signers.employee1.address))
        .to.emit(payroll, "EmployeeRemoved")
        .withArgs(signers.employee1.address);

      expect(await payroll.isEmployee(signers.employee1.address)).to.be.false;
      expect(await payroll.getEmployeeCount()).to.equal(0n);
    });

    it("should update employee salary", async function () {
      // Add employee
      const enc1 = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(5000n)
        .encrypt();

      await payroll.addEmployee(
        signers.employee1.address,
        enc1.handles[0],
        enc1.inputProof
      );

      // Update salary
      const enc2 = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(6000n)
        .encrypt();

      await expect(
        payroll.updateSalary(
          signers.employee1.address,
          enc2.handles[0],
          enc2.inputProof
        )
      )
        .to.emit(payroll, "SalaryUpdated")
        .withArgs(signers.employee1.address);
    });
  });

  describe("Funding", function () {
    it("should accept funds from employer", async function () {
      const amount = ethers.parseEther("10");

      await expect(payroll.fund({ value: amount }))
        .to.emit(payroll, "ContractFunded")
        .withArgs(amount);

      expect(await payroll.getBalance()).to.equal(amount);
    });

    it("should accept direct ETH transfers", async function () {
      const amount = ethers.parseEther("5");

      await signers.employer.sendTransaction({
        to: payrollAddress,
        value: amount,
      });

      expect(await payroll.getBalance()).to.equal(amount);
    });

    it("should reject zero funding via fund()", async function () {
      await expect(payroll.fund({ value: 0 })).to.be.revertedWith(
        "Must send funds"
      );
    });
  });

  describe("Access Control", function () {
    it("should prevent non-employer from adding employees", async function () {
      const enc = await fhevm
        .createEncryptedInput(payrollAddress, signers.employee1.address)
        .add64(5000n)
        .encrypt();

      await expect(
        payroll
          .connect(signers.employee1)
          .addEmployee(
            signers.employee2.address,
            enc.handles[0],
            enc.inputProof
          )
      ).to.be.revertedWith("Only employer");
    });

    it("should allow employee to get their salary handle", async function () {
      const enc = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(5000n)
        .encrypt();

      await payroll.addEmployee(
        signers.employee1.address,
        enc.handles[0],
        enc.inputProof
      );

      // Employee should be able to call getMySalary
      const salaryHandle = await payroll
        .connect(signers.employee1)
        .getMySalary();
      expect(salaryHandle).to.not.equal(0n);
    });

    it("should prevent non-employee from getting salary", async function () {
      await expect(
        payroll.connect(signers.employee1).getMySalary()
      ).to.be.revertedWith("Not an employee");
    });
  });

  describe("View Functions", function () {
    it("should return correct payroll info", async function () {
      await payroll.fund({ value: ethers.parseEther("1") });

      const info = await payroll.getPayrollInfo();
      expect(info.employeeCount).to.equal(0n);
      expect(info.balance).to.equal(ethers.parseEther("1"));
      expect(info.period).to.equal(BigInt(PAYMENT_PERIOD));
    });

    it("should check payment due status", async function () {
      expect(await payroll.isPaymentDue(signers.employee1.address)).to.be.false;
    });
  });
});

```

{% endtab %}

{% endtabs %}
