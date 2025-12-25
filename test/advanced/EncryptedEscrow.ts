import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedEscrow, EncryptedEscrow__factory } from "../types";
import { expect } from "chai";

/**
 * Encrypted Escrow Tests
 *
 * Tests the private escrow process and dispute resolution using FHE.
 * Validates that transaction amounts remain secret while permitting conditional releases.
 */
type Signers = {
  buyer: HardhatEthersSigner;
  seller: HardhatEthersSigner;
  arbiter: HardhatEthersSigner;
};

const ARBITER_FEE = 1; // 1%
const DEADLINE_OFFSET = 86400; // 1 day

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "EncryptedEscrow"
  )) as EncryptedEscrow__factory;
  const escrow = (await factory.deploy(ARBITER_FEE)) as EncryptedEscrow;
  const escrowAddress = await escrow.getAddress();

  return { escrow, escrowAddress };
}

/**
 * Encrypted Escrow Tests
 *
 * Tests secure escrow with encrypted amounts and dispute resolution.
 */
describe("EncryptedEscrow", function () {
  let signers: Signers;
  let escrow: EncryptedEscrow;
  let escrowAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      buyer: ethSigners[0],
      seller: ethSigners[1],
      arbiter: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ escrow, escrowAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await escrow.owner()).to.equal(signers.buyer.address);
      expect(await escrow.arbiterFeePercent()).to.equal(BigInt(ARBITER_FEE));
      expect(await escrow.escrowCount()).to.equal(0n);
    });

    it("should reject fee percentage above 10%", async function () {
      const factory = await ethers.getContractFactory("EncryptedEscrow");
      await expect(factory.deploy(15)).to.be.revertedWith("Fee too high");
    });
  });

  describe("Escrow Creation", function () {
    it("should create escrow with encrypted amount", async function () {
      const amount = ethers.parseEther("1");
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      // 🔐 Encrypt the escrow amount:
      // This amount serves as a private commitment that the contract will enforce.
      const encryptedAmount = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(amount)
        .encrypt();

      await expect(
        escrow.createEscrow(
          signers.seller.address,
          signers.arbiter.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          deadline
        )
      ).to.emit(escrow, "EscrowCreated");

      expect(await escrow.escrowCount()).to.equal(1n);
    });

    it("should reject invalid seller address", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(1000n)
        .encrypt();

      await expect(
        escrow.createEscrow(
          ethers.ZeroAddress,
          signers.arbiter.address,
          enc.handles[0],
          enc.inputProof,
          deadline
        )
      ).to.be.revertedWith("Invalid seller");
    });

    it("should reject buyer as seller", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(1000n)
        .encrypt();

      await expect(
        escrow.createEscrow(
          signers.buyer.address,
          signers.arbiter.address,
          enc.handles[0],
          enc.inputProof,
          deadline
        )
      ).to.be.revertedWith("Buyer cannot be seller");
    });
  });

  describe("Funding", function () {
    let escrowId: bigint;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(ethers.parseEther("1"))
        .encrypt();

      await escrow.createEscrow(
        signers.seller.address,
        signers.arbiter.address,
        enc.handles[0],
        enc.inputProof,
        deadline
      );
      escrowId = 1n;
    });

    it("should allow buyer to fund escrow", async function () {
      const amount = ethers.parseEther("1");

      await expect(escrow.fundEscrow(escrowId, { value: amount }))
        .to.emit(escrow, "EscrowFunded")
        .withArgs(escrowId, amount);

      const info = await escrow.getEscrow(escrowId);
      expect(info.depositedAmount).to.equal(amount);
      expect(info.state).to.equal(1); // 1 = Funded
    });

    it("should prevent non-buyer from funding", async function () {
      await expect(
        escrow
          .connect(signers.seller)
          .fundEscrow(escrowId, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Only buyer can fund");
    });
  });

  describe("Release and Refund", function () {
    let escrowId: bigint;
    const DEPOSIT = ethers.parseEther("1");

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(DEPOSIT)
        .encrypt();

      await escrow.createEscrow(
        signers.seller.address,
        signers.arbiter.address,
        enc.handles[0],
        enc.inputProof,
        deadline
      );
      escrowId = 1n;
      await escrow.fundEscrow(escrowId, { value: DEPOSIT });
    });

    it("should allow buyer to release funds", async function () {
      const sellerBalanceBefore = await ethers.provider.getBalance(
        signers.seller.address
      );

      await expect(escrow.release(escrowId))
        .to.emit(escrow, "FundsReleased")
        .withArgs(escrowId, signers.seller.address);

      const sellerBalanceAfter = await ethers.provider.getBalance(
        signers.seller.address
      );
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(DEPOSIT);
    });

    it("should prevent non-buyer from releasing", async function () {
      await expect(
        escrow.connect(signers.seller).release(escrowId)
      ).to.be.revertedWith("Only buyer can release");
    });

    it("should prevent refund before deadline", async function () {
      await expect(escrow.requestRefund(escrowId)).to.be.revertedWith(
        "Deadline not passed"
      );
    });
  });

  describe("Dispute Resolution", function () {
    let escrowId: bigint;
    const DEPOSIT = ethers.parseEther("1");

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(DEPOSIT)
        .encrypt();

      await escrow.createEscrow(
        signers.seller.address,
        signers.arbiter.address,
        enc.handles[0],
        enc.inputProof,
        deadline
      );
      escrowId = 1n;
      await escrow.fundEscrow(escrowId, { value: DEPOSIT });
    });

    it("should allow buyer to raise dispute", async function () {
      await expect(escrow.raiseDispute(escrowId))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(escrowId, signers.buyer.address);

      const info = await escrow.getEscrow(escrowId);
      expect(info.state).to.equal(4); // 4 = Disputed
    });

    it("should allow arbiter to resolve in favor of buyer", async function () {
      await escrow.raiseDispute(escrowId);

      const buyerBalanceBefore = await ethers.provider.getBalance(
        signers.buyer.address
      );

      await expect(
        escrow.connect(signers.arbiter).resolveDispute(escrowId, true)
      )
        .to.emit(escrow, "DisputeResolved")
        .withArgs(escrowId, signers.buyer.address);

      const buyerBalanceAfter = await ethers.provider.getBalance(
        signers.buyer.address
      );
      // 🛡️ Resolution logic:
      // Buyer receives the original amount minus the arbiter's fee (1% in this test).
      const expected = DEPOSIT - DEPOSIT / 100n;
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(expected);
    });

    it("should prevent non-arbiter from resolving", async function () {
      await escrow.raiseDispute(escrowId);

      await expect(escrow.resolveDispute(escrowId, true)).to.be.revertedWith(
        "Only arbiter"
      );
    });
  });

  describe("View Functions", function () {
    it("should check deadline status", async function () {
      // Non-existent escrow with deadline = 0 means timestamp > 0 is always true
      expect(await escrow.isDeadlinePassed(999)).to.be.true;
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    let escrowId: bigint;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      // Create encrypted amount for escrow creation
      const encryptedAmount = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(1000)
        .encrypt();

      const tx = await escrow
        .connect(signers.buyer)
        .createEscrow(
          signers.seller.address,
          signers.arbiter.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          deadline
        );
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "EscrowCreated"
      );
      escrowId = event?.args?.[0] || 1n;
    });

    it("should reject double funding", async function () {
      // First funding
      await escrow.connect(signers.buyer).fundEscrow(escrowId, { value: 1000 });

      // Second funding attempt
      await expect(
        escrow.connect(signers.buyer).fundEscrow(escrowId, { value: 500 })
      ).to.be.revertedWith("Invalid state");
    });

    it("should allow release before deadline", async function () {
      // Fund escrow
      await escrow.connect(signers.buyer).fundEscrow(escrowId, { value: 1000 });

      // Release should work before deadline
      await expect(escrow.connect(signers.buyer).release(escrowId)).to.not.be
        .reverted;
    });

    it("should reject operations on invalid escrow ID", async function () {
      const invalidId = 999n;

      await expect(
        escrow.connect(signers.buyer).fundEscrow(invalidId, { value: 1000 })
      ).to.be.revertedWith("Only buyer can fund");
    });
  });
});
