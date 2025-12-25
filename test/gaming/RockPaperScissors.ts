import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { RockPaperScissors, RockPaperScissors__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  player1: HardhatEthersSigner;
  player2: HardhatEthersSigner;
  player3: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "RockPaperScissors"
  )) as RockPaperScissors__factory;
  const rps = (await factory.deploy()) as RockPaperScissors;
  const rpsAddress = await rps.getAddress();

  return { rps, rpsAddress };
}

/**
 * Rock-Paper-Scissors Tests
 *
 * Tests encrypted move submission and FHE-based winner determination.
 * Demonstrates commit-reveal pattern without trusted third party.
 */
describe("RockPaperScissors", function () {
  let signers: Signers;
  let rps: RockPaperScissors;
  let rpsAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      player1: ethSigners[1],
      player2: ethSigners[2],
      player3: ethSigners[3],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ rps, rpsAddress } = await deployFixture());
  });

  describe("Game Setup", function () {
    it("should initialize with correct state", async function () {
      const state = await rps.getGameState();
      expect(state.p1).to.equal(ethers.ZeroAddress);
      expect(state.p2).to.equal(ethers.ZeroAddress);
      expect(state.currentState).to.equal(0); // WaitingForPlayers
      expect(state.currentWinner).to.equal(ethers.ZeroAddress);
      expect(state.currentGameId).to.equal(1n);
    });

    it("should allow first player to join", async function () {
      // Create encrypted move (Rock = 0)
      const encryptedMove = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();

      await rps
        .connect(signers.player1)
        .play(encryptedMove.handles[0], encryptedMove.inputProof);

      expect(await rps.player1()).to.equal(signers.player1.address);
      expect(await rps.state()).to.equal(0); // Still waiting for player 2
    });

    it("should transition to BothMoved when second player joins", async function () {
      // Player 1 plays Rock
      const enc1 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();
      await rps.connect(signers.player1).play(enc1.handles[0], enc1.inputProof);

      // Player 2 plays Paper
      const enc2 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player2.address)
        .add8(1)
        .encrypt();
      await rps.connect(signers.player2).play(enc2.handles[0], enc2.inputProof);

      expect(await rps.player2()).to.equal(signers.player2.address);
      expect(await rps.state()).to.equal(1); // BothMoved
    });
  });

  describe("Move Validation", function () {
    it("should prevent same player from playing twice", async function () {
      const enc1 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();
      await rps.connect(signers.player1).play(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(1)
        .encrypt();

      await expect(
        rps.connect(signers.player1).play(enc2.handles[0], enc2.inputProof)
      ).to.be.revertedWith("Already in this game");
    });

    it("should prevent third player from joining after game is full", async function () {
      // Player 1 plays
      const enc1 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();
      await rps.connect(signers.player1).play(enc1.handles[0], enc1.inputProof);

      // Player 2 plays
      const enc2 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player2.address)
        .add8(1)
        .encrypt();
      await rps.connect(signers.player2).play(enc2.handles[0], enc2.inputProof);

      // Player 3 tries to play
      const enc3 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player3.address)
        .add8(2)
        .encrypt();

      await expect(
        rps.connect(signers.player3).play(enc3.handles[0], enc3.inputProof)
      ).to.be.revertedWith("Game not accepting moves");
    });
  });

  describe("Winner Determination", function () {
    it("should compute winner via FHE after both players move", async function () {
      // Player 1: Rock (0)
      const enc1 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();
      await rps.connect(signers.player1).play(enc1.handles[0], enc1.inputProof);

      // Player 2: Paper (1) - Paper beats Rock
      const enc2 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player2.address)
        .add8(1)
        .encrypt();
      await rps.connect(signers.player2).play(enc2.handles[0], enc2.inputProof);

      // Determine winner
      await expect(rps.determineWinner()).to.emit(rps, "GameResult");

      expect(await rps.state()).to.equal(2); // Revealed
    });

    it("should prevent determineWinner before both players move", async function () {
      await expect(rps.determineWinner()).to.be.revertedWith(
        "Not ready to determine winner"
      );
    });
  });

  describe("Game Reset", function () {
    it("should allow reset after game is revealed", async function () {
      // Play a full game
      const enc1 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();
      await rps.connect(signers.player1).play(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(rpsAddress, signers.player2.address)
        .add8(1)
        .encrypt();
      await rps.connect(signers.player2).play(enc2.handles[0], enc2.inputProof);

      await rps.determineWinner();

      // Reset game
      await rps.resetGame();

      const state = await rps.getGameState();
      expect(state.p1).to.equal(ethers.ZeroAddress);
      expect(state.p2).to.equal(ethers.ZeroAddress);
      expect(state.currentState).to.equal(0); // WaitingForPlayers
      expect(state.currentGameId).to.equal(2n); // Incremented
    });

    it("should prevent reset before game is finished", async function () {
      await expect(rps.resetGame()).to.be.revertedWith(
        "Current game not finished"
      );
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should accept any value as move (no on-chain validation)", async function () {
      // FHE doesn't validate encrypted values on-chain
      const encryptedMove = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(99) // Invalid move value
        .encrypt();

      // Contract accepts encrypted value without validation
      await expect(
        rps
          .connect(signers.player1)
          .play(encryptedMove.handles[0], encryptedMove.inputProof)
      ).to.not.be.reverted;
    });

    it("should reject reset while game is in progress", async function () {
      // Player 1 joins
      const enc = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(0)
        .encrypt();
      await rps.connect(signers.player1).play(enc.handles[0], enc.inputProof);

      // Try to reset
      await expect(rps.resetGame()).to.be.revertedWith(
        "Current game not finished"
      );
    });

    it("should reject determine winner with only one player", async function () {
      const enc = await fhevm
        .createEncryptedInput(rpsAddress, signers.player1.address)
        .add8(1)
        .encrypt();
      await rps.connect(signers.player1).play(enc.handles[0], enc.inputProof);

      await expect(rps.determineWinner()).to.be.revertedWith(
        "Not ready to determine winner"
      );
    });
  });
});
