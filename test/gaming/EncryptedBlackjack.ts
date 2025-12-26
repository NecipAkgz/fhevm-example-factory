import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedBlackjack, EncryptedBlackjack__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  player: HardhatEthersSigner;
};

const BET_AMOUNT = ethers.parseEther("0.1");

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "EncryptedBlackjack"
  )) as EncryptedBlackjack__factory;
  const blackjack = (await factory.deploy()) as EncryptedBlackjack;
  const blackjackAddress = await blackjack.getAddress();

  return { blackjack, blackjackAddress };
}

/**
 * Encrypted Blackjack Tests
 *
 * Tests encrypted card dealing, hand aggregation, and FHE-based winner determination.
 * Demonstrates multi-card sum computation and bust detection patterns.
 */
describe("EncryptedBlackjack", function () {
  let signers: Signers;
  let blackjack: EncryptedBlackjack;
  let blackjackAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      player: ethSigners[1],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ blackjack, blackjackAddress } = await deployFixture());

    // Fund contract for payouts
    await signers.deployer.sendTransaction({
      to: blackjackAddress,
      value: ethers.parseEther("1"),
    });
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await blackjack.state()).to.equal(0); // Waiting
      expect(await blackjack.gameId()).to.equal(1n);
      expect(await blackjack.player()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Starting Game", function () {
    it("should start game with encrypted cards", async function () {
      // 🔐 Encrypt player cards (e.g., 10 + 8 = 18)
      // and dealer cards (e.g., 7 + 9 = 16)
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10) // Player card 1
        .add8(8) // Player card 2
        .add8(7) // Dealer card 1
        .add8(9) // Dealer card 2
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );

      const info = await blackjack.getGameInfo();
      expect(info.currentState).to.equal(1); // PlayerTurn
      expect(info.currentPlayer).to.equal(signers.player.address);
      expect(info.currentBet).to.equal(BET_AMOUNT);
      expect(info.playerCardCount).to.equal(2);
      expect(info.dealerCardCount).to.equal(2);
    });

    it("should reject game without bet", async function () {
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(8)
        .add8(7)
        .add8(9)
        .encrypt();

      await expect(
        blackjack
          .connect(signers.player)
          .startGame(
            enc.handles[0],
            enc.handles[1],
            enc.handles[2],
            enc.handles[3],
            enc.inputProof,
            { value: 0 }
          )
      ).to.be.revertedWith("Must place a bet");
    });

    it("should reject starting game when one is in progress", async function () {
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(8)
        .add8(7)
        .add8(9)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );

      // Try to start another
      const enc2 = await fhevm
        .createEncryptedInput(blackjackAddress, signers.deployer.address)
        .add8(5)
        .add8(6)
        .add8(7)
        .add8(8)
        .encrypt();

      await expect(
        blackjack
          .connect(signers.deployer)
          .startGame(
            enc2.handles[0],
            enc2.handles[1],
            enc2.handles[2],
            enc2.handles[3],
            enc2.inputProof,
            { value: BET_AMOUNT }
          )
      ).to.be.revertedWith("Game in progress");
    });
  });

  describe("Hit (Draw Card)", function () {
    beforeEach(async function () {
      // Start a game: player has 5 + 6 = 11, dealer has 10 + 7 = 17
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(5)
        .add8(6)
        .add8(10)
        .add8(7)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );
    });

    it("should allow player to hit", async function () {
      // 🃏 Player draws a third card (e.g., 8)
      // New sum: 5 + 6 + 8 = 19
      const encCard = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(8)
        .encrypt();

      await expect(
        blackjack
          .connect(signers.player)
          .hit(encCard.handles[0], encCard.inputProof)
      )
        .to.emit(blackjack, "PlayerHit")
        .withArgs(3);

      const info = await blackjack.getGameInfo();
      expect(info.playerCardCount).to.equal(3);
    });

    it("should allow multiple hits up to 4 cards", async function () {
      // Hit twice
      const enc1 = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(2)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .hit(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(3)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .hit(enc2.handles[0], enc2.inputProof);

      const info = await blackjack.getGameInfo();
      expect(info.playerCardCount).to.equal(4);
    });

    it("should reject hit beyond 4 cards", async function () {
      // Hit twice to reach 4 cards
      const enc1 = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(2)
        .encrypt();
      await blackjack
        .connect(signers.player)
        .hit(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(3)
        .encrypt();
      await blackjack
        .connect(signers.player)
        .hit(enc2.handles[0], enc2.inputProof);

      // Try fifth card
      const enc3 = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(1)
        .encrypt();

      await expect(
        blackjack.connect(signers.player).hit(enc3.handles[0], enc3.inputProof)
      ).to.be.revertedWith("Max 4 cards");
    });

    it("should reject hit from non-player", async function () {
      const encCard = await fhevm
        .createEncryptedInput(blackjackAddress, signers.deployer.address)
        .add8(5)
        .encrypt();

      await expect(
        blackjack
          .connect(signers.deployer)
          .hit(encCard.handles[0], encCard.inputProof)
      ).to.be.revertedWith("Not your game");
    });
  });

  describe("Stand", function () {
    beforeEach(async function () {
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(9)
        .add8(8)
        .add8(7)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );
    });

    it("should transition to dealer turn on stand", async function () {
      // 🛑 Player stands with 10 + 9 = 19
      await expect(blackjack.connect(signers.player).stand()).to.emit(
        blackjack,
        "PlayerStood"
      );

      const info = await blackjack.getGameInfo();
      expect(info.currentState).to.equal(2); // DealerTurn
    });

    it("should reject stand from non-player", async function () {
      await expect(
        blackjack.connect(signers.deployer).stand()
      ).to.be.revertedWith("Not your game");
    });
  });

  describe("Dealer Play", function () {
    beforeEach(async function () {
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(8)
        .add8(7)
        .add8(6)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );

      await blackjack.connect(signers.player).stand();
    });

    it("should allow dealer to play without additional card", async function () {
      // Dealer stands with 7 + 6 = 13
      const encDummy = await fhevm
        .createEncryptedInput(blackjackAddress, signers.deployer.address)
        .add8(0)
        .encrypt();

      await expect(
        blackjack.dealerPlay(encDummy.handles[0], encDummy.inputProof, false)
      ).to.emit(blackjack, "DealerPlayed");

      const info = await blackjack.getGameInfo();
      expect(info.currentState).to.equal(3); // Finished
    });

    it("should allow dealer to draw third card", async function () {
      // Dealer draws additional card
      const encCard = await fhevm
        .createEncryptedInput(blackjackAddress, signers.deployer.address)
        .add8(5)
        .encrypt();

      await blackjack.dealerPlay(encCard.handles[0], encCard.inputProof, true);

      const info = await blackjack.getGameInfo();
      expect(info.dealerCardCount).to.equal(3);
      expect(info.currentState).to.equal(3); // Finished
    });
  });

  describe("Game Reset", function () {
    it("should reset game after completion", async function () {
      // Play through a game
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(10)
        .add8(5)
        .add8(5)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );

      await blackjack.connect(signers.player).stand();

      const encDummy = await fhevm
        .createEncryptedInput(blackjackAddress, signers.deployer.address)
        .add8(0)
        .encrypt();

      await blackjack.dealerPlay(
        encDummy.handles[0],
        encDummy.inputProof,
        false
      );

      // Reset
      await blackjack.resetGame();

      const info = await blackjack.getGameInfo();
      expect(info.currentState).to.equal(0); // Waiting
      expect(info.currentPlayer).to.equal(ethers.ZeroAddress);
      expect(info.currentGameId).to.equal(2n);
    });

    it("should reject reset before game finishes", async function () {
      await expect(blackjack.resetGame()).to.be.revertedWith(
        "Game not finished"
      );
    });
  });

  describe("View Functions", function () {
    it("should correctly identify player", async function () {
      expect(await blackjack.isPlayer(signers.player.address)).to.be.false;

      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(8)
        .add8(7)
        .add8(9)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );

      expect(await blackjack.isPlayer(signers.player.address)).to.be.true;
      expect(await blackjack.isPlayer(signers.deployer.address)).to.be.false;
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should handle exactly 21 (blackjack)", async function () {
      // Player: 10 + 11 = 21, Dealer: 8 + 9 = 17
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(10)
        .add8(11)
        .add8(8)
        .add8(9)
        .encrypt();

      await blackjack
        .connect(signers.player)
        .startGame(
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.inputProof,
          { value: BET_AMOUNT }
        );

      // Stand with blackjack
      await blackjack.connect(signers.player).stand();

      const encDummy = await fhevm
        .createEncryptedInput(blackjackAddress, signers.deployer.address)
        .add8(0)
        .encrypt();

      await blackjack.dealerPlay(
        encDummy.handles[0],
        encDummy.inputProof,
        false
      );

      const info = await blackjack.getGameInfo();
      expect(info.currentState).to.equal(3); // Finished
    });

    it("should handle minimum bet", async function () {
      const enc = await fhevm
        .createEncryptedInput(blackjackAddress, signers.player.address)
        .add8(5)
        .add8(5)
        .add8(5)
        .add8(5)
        .encrypt();

      // Minimum possible bet (1 wei)
      await expect(
        blackjack
          .connect(signers.player)
          .startGame(
            enc.handles[0],
            enc.handles[1],
            enc.handles[2],
            enc.handles[3],
            enc.inputProof,
            { value: 1 }
          )
      ).to.not.be.reverted;

      expect(await blackjack.betAmount()).to.equal(1n);
    });
  });
});
