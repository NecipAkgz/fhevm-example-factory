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

      // 🔐 Encrypt the salary locally:
      // Only the employer's handle will be stored, keeping the salary secret.
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

      // 🛡️ Access Control & Privacy:
      // Employees can fetch THEIR OWN encrypted salary handle.
      // They cannot see other employees' salaries.
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

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should reject removing non-existent employee", async function () {
      await expect(
        payroll.removeEmployee(signers.employee1.address)
      ).to.be.revertedWith("Not an employee");
    });

    it("should reject updating salary for non-employee", async function () {
      const encryptedSalary = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(6000)
        .encrypt();

      await expect(
        payroll.updateSalary(
          signers.employee1.address,
          encryptedSalary.handles[0],
          encryptedSalary.inputProof
        )
      ).to.be.revertedWith("Not an employee");
    });

    it("should reject zero funding", async function () {
      await expect(payroll.fund({ value: 0 })).to.be.revertedWith(
        "Must send funds"
      );
    });

    it("should reject non-employer from removing employee", async function () {
      // First add an employee
      const enc = await fhevm
        .createEncryptedInput(payrollAddress, signers.employer.address)
        .add64(5000)
        .encrypt();
      await payroll.addEmployee(
        signers.employee1.address,
        enc.handles[0],
        enc.inputProof
      );

      // Try to remove as non-employer
      await expect(
        payroll
          .connect(signers.employee1)
          .removeEmployee(signers.employee1.address)
      ).to.be.revertedWith("Only employer");
    });
  });
});
