import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedLottery, EncryptedLottery__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  player1: HardhatEthersSigner;
  player2: HardhatEthersSigner;
};

const TICKET_PRICE = ethers.parseEther("0.01");
const DURATION = 3600; // 1 hour

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "EncryptedLottery"
  )) as EncryptedLottery__factory;
  const lottery = (await factory.deploy(
    TICKET_PRICE,
    DURATION
  )) as EncryptedLottery;
  const lotteryAddress = await lottery.getAddress();

  return { lottery, lotteryAddress };
}

/**
 * Encrypted Lottery Tests
 *
 * Tests private ticket purchases and FHE-based winner determination.
 */
describe("EncryptedLottery", function () {
  let signers: Signers;
  let lottery: EncryptedLottery;
  let lotteryAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      player1: ethSigners[1],
      player2: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ lottery, lotteryAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await lottery.ticketPrice()).to.equal(TICKET_PRICE);
      expect(await lottery.state()).to.equal(0); // Open
      expect(await lottery.roundNumber()).to.equal(1n);
      expect(await lottery.owner()).to.equal(signers.deployer.address);
    });

    it("should reject zero ticket price", async function () {
      const factory = await ethers.getContractFactory("EncryptedLottery");
      await expect(factory.deploy(0, DURATION)).to.be.revertedWith(
        "Ticket price must be > 0"
      );
    });

    it("should reject zero duration", async function () {
      const factory = await ethers.getContractFactory("EncryptedLottery");
      await expect(factory.deploy(TICKET_PRICE, 0)).to.be.revertedWith(
        "Duration must be > 0"
      );
    });
  });

  describe("Ticket Purchase", function () {
    it("should allow ticket purchase with encrypted number", async function () {
      const encryptedNumber = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(123456789n)
        .encrypt();

      await lottery
        .connect(signers.player1)
        .buyTicket(encryptedNumber.handles[0], encryptedNumber.inputProof, {
          value: TICKET_PRICE,
        });

      expect(await lottery.getTicketCount()).to.equal(1n);
      const playerTickets = await lottery.getPlayerTickets(
        signers.player1.address
      );
      expect(playerTickets.length).to.equal(1);
    });

    it("should reject insufficient payment", async function () {
      const encryptedNumber = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(123456789n)
        .encrypt();

      await expect(
        lottery
          .connect(signers.player1)
          .buyTicket(encryptedNumber.handles[0], encryptedNumber.inputProof, {
            value: ethers.parseEther("0.001"),
          })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should accumulate prize pool", async function () {
      // Player 1 buys ticket
      const enc1 = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(111111n)
        .encrypt();

      await lottery
        .connect(signers.player1)
        .buyTicket(enc1.handles[0], enc1.inputProof, { value: TICKET_PRICE });

      // Player 2 buys ticket
      const enc2 = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player2.address)
        .add64(222222n)
        .encrypt();

      await lottery
        .connect(signers.player2)
        .buyTicket(enc2.handles[0], enc2.inputProof, { value: TICKET_PRICE });

      expect(await lottery.prizePool()).to.equal(TICKET_PRICE * 2n);
      expect(await lottery.getTicketCount()).to.equal(2n);
    });
  });

  describe("Drawing", function () {
    it("should prevent drawing before lottery ends", async function () {
      const enc = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(123456n)
        .encrypt();

      await lottery
        .connect(signers.player1)
        .buyTicket(enc.handles[0], enc.inputProof, { value: TICKET_PRICE });

      await expect(lottery.startDrawing()).to.be.revertedWith(
        "Lottery not ended"
      );
    });

    it("should prevent drawing with no tickets", async function () {
      // Fast forward past end time
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(lottery.startDrawing()).to.be.revertedWith(
        "No tickets sold"
      );
    });

    it("should start drawing after lottery ends", async function () {
      const enc = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(123456n)
        .encrypt();

      await lottery
        .connect(signers.player1)
        .buyTicket(enc.handles[0], enc.inputProof, { value: TICKET_PRICE });

      // Fast forward past end time
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(lottery.startDrawing())
        .to.emit(lottery, "DrawingStarted")
        .withArgs(1);

      expect(await lottery.state()).to.equal(1); // Drawing
    });
  });

  describe("View Functions", function () {
    it("should return correct lottery info", async function () {
      const info = await lottery.getLotteryInfo();
      expect(info.currentState).to.equal(0); // Open
      expect(info.currentPrizePool).to.equal(0n);
      expect(info.currentRound).to.equal(1n);
      expect(info.totalTickets).to.equal(0n);
    });

    it("should track time remaining", async function () {
      const remaining = await lottery.timeRemaining();
      expect(remaining).to.be.lessThanOrEqual(BigInt(DURATION));
      expect(remaining).to.be.greaterThan(0n);
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to start drawing", async function () {
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        lottery.connect(signers.player1).startDrawing()
      ).to.be.revertedWith("Only owner");
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should allow multiple tickets from same player", async function () {
      const enc1 = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(111111n)
        .encrypt();
      await lottery
        .connect(signers.player1)
        .buyTicket(enc1.handles[0], enc1.inputProof, { value: TICKET_PRICE });

      const enc2 = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(222222n)
        .encrypt();
      await lottery
        .connect(signers.player1)
        .buyTicket(enc2.handles[0], enc2.inputProof, { value: TICKET_PRICE });

      const playerTickets = await lottery.getPlayerTickets(
        signers.player1.address
      );
      expect(playerTickets.length).to.equal(2);
    });

    it("should reject ticket purchase after lottery ends", async function () {
      // Fast forward past end time
      await ethers.provider.send("evm_increaseTime", [DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      const enc = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(123456n)
        .encrypt();

      await expect(
        lottery
          .connect(signers.player1)
          .buyTicket(enc.handles[0], enc.inputProof, { value: TICKET_PRICE })
      ).to.be.revertedWith("Lottery ended");
    });

    it("should accept exact payment amount", async function () {
      const enc = await fhevm
        .createEncryptedInput(lotteryAddress, signers.player1.address)
        .add64(123456n)
        .encrypt();

      await expect(
        lottery
          .connect(signers.player1)
          .buyTicket(enc.handles[0], enc.inputProof, { value: TICKET_PRICE })
      ).to.not.be.reverted;
    });
  });
});
