import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedPoker, EncryptedPoker__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  player0: HardhatEthersSigner;
  player1: HardhatEthersSigner;
};

const MIN_BET = ethers.parseEther("0.01");

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "EncryptedPoker"
  )) as EncryptedPoker__factory;
  const poker = (await factory.deploy(MIN_BET)) as EncryptedPoker;
  const pokerAddress = await poker.getAddress();

  return { poker, pokerAddress };
}

/**
 * Encrypted Poker Tests
 *
 * Tests encrypted hole cards and FHE-based hand comparison.
 * Demonstrates multi-player private state in gaming.
 */
describe("EncryptedPoker", function () {
  let signers: Signers;
  let poker: EncryptedPoker;
  let pokerAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      player0: ethSigners[1],
      player1: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ poker, pokerAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await poker.minBet()).to.equal(MIN_BET);
      expect(await poker.state()).to.equal(0); // WaitingForPlayers
      expect(await poker.gameId()).to.equal(1n);
      expect(await poker.pot()).to.equal(0n);
    });

    it("should reject zero min bet", async function () {
      const factory = await ethers.getContractFactory("EncryptedPoker");
      await expect(factory.deploy(0)).to.be.revertedWith("Min bet must be > 0");
    });
  });

  describe("Joining Game", function () {
    it("should allow first player to join with encrypted cards", async function () {
      // Player 0 joins with cards (King=13, Queen=12)
      const enc = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(13) // King
        .add8(12) // Queen
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc.handles[0], enc.handles[1], enc.inputProof, {
          value: MIN_BET,
        });

      const info = await poker.getGameInfo();
      expect(info.player0).to.equal(signers.player0.address);
      expect(info.currentPot).to.equal(MIN_BET);
      expect(info.currentState).to.equal(0); // Still waiting
    });

    it("should transition to CardsDealt when second player joins", async function () {
      // Player 0 joins
      const enc0 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(10)
        .add8(10)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc0.handles[0], enc0.handles[1], enc0.inputProof, {
          value: MIN_BET,
        });

      // Player 1 joins
      const enc1 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player1.address)
        .add8(5)
        .add8(5)
        .encrypt();

      await expect(
        poker
          .connect(signers.player1)
          .joinGame(enc1.handles[0], enc1.handles[1], enc1.inputProof, {
            value: MIN_BET,
          })
      ).to.emit(poker, "CardsDealt");

      const info = await poker.getGameInfo();
      expect(info.player1).to.equal(signers.player1.address);
      expect(info.currentState).to.equal(1); // CardsDealt
      expect(info.currentPot).to.equal(MIN_BET * 2n);
    });

    it("should reject insufficient bet", async function () {
      const enc = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(1)
        .add8(2)
        .encrypt();

      await expect(
        poker
          .connect(signers.player0)
          .joinGame(enc.handles[0], enc.handles[1], enc.inputProof, {
            value: ethers.parseEther("0.001"),
          })
      ).to.be.revertedWith("Must pay min bet to join");
    });
  });

  describe("Betting", function () {
    beforeEach(async function () {
      // Setup: both players join
      const enc0 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(10)
        .add8(10)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc0.handles[0], enc0.handles[1], enc0.inputProof, {
          value: MIN_BET,
        });

      const enc1 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player1.address)
        .add8(5)
        .add8(5)
        .encrypt();

      await poker
        .connect(signers.player1)
        .joinGame(enc1.handles[0], enc1.handles[1], enc1.inputProof, {
          value: MIN_BET,
        });
    });

    it("should allow betting", async function () {
      const betAmount = ethers.parseEther("0.05");

      await expect(poker.connect(signers.player0).bet({ value: betAmount }))
        .to.emit(poker, "BetPlaced")
        .withArgs(signers.player0.address, betAmount);

      expect(await poker.getPlayerBet(signers.player0.address)).to.equal(
        MIN_BET + betAmount
      );
    });

    it("should accumulate pot", async function () {
      await poker
        .connect(signers.player0)
        .bet({ value: ethers.parseEther("0.02") });
      await poker
        .connect(signers.player1)
        .bet({ value: ethers.parseEther("0.03") });

      const expectedPot =
        MIN_BET * 2n + ethers.parseEther("0.02") + ethers.parseEther("0.03");
      expect(await poker.pot()).to.equal(expectedPot);
    });
  });

  describe("Folding", function () {
    beforeEach(async function () {
      const enc0 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(10)
        .add8(10)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc0.handles[0], enc0.handles[1], enc0.inputProof, {
          value: MIN_BET,
        });

      const enc1 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player1.address)
        .add8(5)
        .add8(5)
        .encrypt();

      await poker
        .connect(signers.player1)
        .joinGame(enc1.handles[0], enc1.handles[1], enc1.inputProof, {
          value: MIN_BET,
        });
    });

    it("should award pot to non-folding player", async function () {
      const player1BalanceBefore = await ethers.provider.getBalance(
        signers.player1.address
      );

      await expect(poker.connect(signers.player0).fold())
        .to.emit(poker, "PlayerFolded")
        .withArgs(signers.player0.address);

      const info = await poker.getGameInfo();
      expect(info.currentWinner).to.equal(signers.player1.address);
      expect(info.currentState).to.equal(4); // Finished

      const player1BalanceAfter = await ethers.provider.getBalance(
        signers.player1.address
      );
      expect(player1BalanceAfter - player1BalanceBefore).to.equal(MIN_BET * 2n);
    });
  });

  describe("Showdown", function () {
    beforeEach(async function () {
      // Player 0: high hand (King + Queen = 25)
      const enc0 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(13) // King
        .add8(12) // Queen
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc0.handles[0], enc0.handles[1], enc0.inputProof, {
          value: MIN_BET,
        });

      // Player 1: low hand (2 + 3 = 5)
      const enc1 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player1.address)
        .add8(2)
        .add8(3)
        .encrypt();

      await poker
        .connect(signers.player1)
        .joinGame(enc1.handles[0], enc1.handles[1], enc1.inputProof, {
          value: MIN_BET,
        });
    });

    it("should start showdown and emit event", async function () {
      await expect(poker.showdown()).to.emit(poker, "ShowdownStarted");

      const info = await poker.getGameInfo();
      expect(info.currentState).to.equal(3); // Showdown
    });

    it("should prevent showdown if someone folded", async function () {
      await poker.connect(signers.player0).fold();

      await expect(poker.showdown()).to.be.revertedWith(
        "Not ready for showdown"
      );
    });
  });

  describe("Game Reset", function () {
    it("should reset game after completion", async function () {
      // Setup and fold to finish game
      const enc0 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(1)
        .add8(2)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc0.handles[0], enc0.handles[1], enc0.inputProof, {
          value: MIN_BET,
        });

      const enc1 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player1.address)
        .add8(3)
        .add8(4)
        .encrypt();

      await poker
        .connect(signers.player1)
        .joinGame(enc1.handles[0], enc1.handles[1], enc1.inputProof, {
          value: MIN_BET,
        });

      await poker.connect(signers.player0).fold();

      // Reset
      await poker.resetGame();

      const info = await poker.getGameInfo();
      expect(info.player0).to.equal(ethers.ZeroAddress);
      expect(info.player1).to.equal(ethers.ZeroAddress);
      expect(info.currentState).to.equal(0); // WaitingForPlayers
      expect(info.currentGameId).to.equal(2n);
    });

    it("should prevent reset before game finishes", async function () {
      await expect(poker.resetGame()).to.be.revertedWith("Game not finished");
    });
  });

  describe("View Functions", function () {
    it("should check player status", async function () {
      expect(await poker.isPlayer(signers.player0.address)).to.be.false;

      const enc = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(1)
        .add8(2)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc.handles[0], enc.handles[1], enc.inputProof, {
          value: MIN_BET,
        });

      expect(await poker.isPlayer(signers.player0.address)).to.be.true;
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should reject same player joining twice", async function () {
      const enc = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(10)
        .add8(10)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc.handles[0], enc.handles[1], enc.inputProof, {
          value: MIN_BET,
        });

      // Try to join again
      const enc2 = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(5)
        .add8(5)
        .encrypt();

      await expect(
        poker
          .connect(signers.player0)
          .joinGame(enc2.handles[0], enc2.handles[1], enc2.inputProof, {
            value: MIN_BET,
          })
      ).to.be.revertedWith("Already in game");
    });

    it("should reject bet before cards dealt", async function () {
      // Only one player joined
      const enc = await fhevm
        .createEncryptedInput(pokerAddress, signers.player0.address)
        .add8(10)
        .add8(10)
        .encrypt();

      await poker
        .connect(signers.player0)
        .joinGame(enc.handles[0], enc.handles[1], enc.inputProof, {
          value: MIN_BET,
        });

      await expect(
        poker.connect(signers.player0).bet({ value: MIN_BET })
      ).to.be.revertedWith("Not betting phase");
    });

    it("should reject showdown before cards dealt", async function () {
      await expect(poker.showdown()).to.be.revertedWith(
        "Not ready for showdown"
      );
    });
  });
});
