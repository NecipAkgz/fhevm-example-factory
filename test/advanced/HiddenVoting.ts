import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import * as hre from "hardhat";

/**
 * Hidden Voting Tests
 *
 * Tests the private voting mechanism and batched result decryption using FHE.
 * Validates that individual votes remain secret while final tallies are computed on-chain.
 */
describe("HiddenVoting", function () {
  let voting: any;
  let owner: any;
  let voter1: any;
  let voter2: any;
  let voter3: any;

  const PROPOSAL = "Should we upgrade to v2?";

  async function deployVoting(durationSeconds: number = 60) {
    const votingContract = await ethers.deployContract("HiddenVoting", [
      PROPOSAL,
      durationSeconds,
    ]);
    return votingContract;
  }

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();
  });

  describe("Voting Creation", function () {
    it("should create voting with correct parameters", async function () {
      voting = await deployVoting(120);

      expect(await voting.votingState()).to.equal(0); // Active
      expect(await voting.proposal()).to.equal(PROPOSAL);
      expect(await voting.voterCount()).to.equal(0);
    });

    it("should revert with empty proposal", async function () {
      await expect(
        ethers.deployContract("HiddenVoting", ["", 60])
      ).to.be.revertedWith("Empty proposal");
    });

    it("should revert with zero duration", async function () {
      await expect(
        ethers.deployContract("HiddenVoting", [PROPOSAL, 0])
      ).to.be.revertedWith("Duration must be positive");
    });
  });

  describe("Casting Votes", function () {
    beforeEach(async function () {
      voting = await deployVoting(3600); // 1 hour
    });

    it("should accept Yes vote (1)", async function () {
      // 🔐 Encrypt the vote locally:
      // 1 = Yes, 0 = No.
      const encryptedVote = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1) // Yes
        .encrypt();

      // 🚀 Submit the encrypted vote handle and proof:
      await expect(
        voting
          .connect(voter1)
          .vote(encryptedVote.handles[0], encryptedVote.inputProof)
      ).to.not.be.reverted;

      expect(await voting.hasVoted(voter1.address)).to.be.true;
      expect(await voting.voterCount()).to.equal(1);
    });

    it("should accept No vote (0)", async function () {
      const encryptedVote = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(0) // No
        .encrypt();

      await expect(
        voting
          .connect(voter1)
          .vote(encryptedVote.handles[0], encryptedVote.inputProof)
      ).to.not.be.reverted;

      expect(await voting.hasVoted(voter1.address)).to.be.true;
    });

    it("should reject second vote from same address", async function () {
      const enc1 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1)
        .encrypt();
      await voting.connect(voter1).vote(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(0)
        .encrypt();

      await expect(
        voting.connect(voter1).vote(enc2.handles[0], enc2.inputProof)
      ).to.be.revertedWith("Already voted");
    });

    it("should track multiple voters", async function () {
      // Voter 1 - Yes
      const enc1 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1)
        .encrypt();
      await voting.connect(voter1).vote(enc1.handles[0], enc1.inputProof);

      // Voter 2 - No
      const enc2 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter2.address)
        .add8(0)
        .encrypt();
      await voting.connect(voter2).vote(enc2.handles[0], enc2.inputProof);

      // Voter 3 - Yes
      const enc3 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter3.address)
        .add8(1)
        .encrypt();
      await voting.connect(voter3).vote(enc3.handles[0], enc3.inputProof);

      expect(await voting.voterCount()).to.equal(3);
    });
  });

  describe("Close Voting", function () {
    beforeEach(async function () {
      voting = await deployVoting(10); // 10 seconds

      // Cast some votes
      const enc1 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1)
        .encrypt();
      await voting.connect(voter1).vote(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter2.address)
        .add8(0)
        .encrypt();
      await voting.connect(voter2).vote(enc2.handles[0], enc2.inputProof);
    });

    it("should not allow closing before time ends", async function () {
      await expect(voting.connect(owner).closeVoting()).to.be.revertedWith(
        "Voting not yet ended"
      );
    });

    it("should allow owner to close after time passes", async function () {
      await new Promise((resolve) => setTimeout(resolve, 11000));
      await hre.network.provider.send("evm_increaseTime", [12]);
      await hre.network.provider.send("evm_mine");

      await expect(voting.connect(owner).closeVoting()).to.not.be.reverted;
      expect(await voting.votingState()).to.equal(1); // Closed
    });

    it("should not allow non-owner to close", async function () {
      await hre.network.provider.send("evm_increaseTime", [12]);
      await hre.network.provider.send("evm_mine");

      await expect(voting.connect(voter1).closeVoting()).to.be.revertedWith(
        "Only owner can call"
      );
    });
  });

  describe("Full Voting Flow", function () {
    it("should correctly tally votes", async function () {
      if (!hre.fhevm.isMock) {
        console.log("Skipping: Test requires mock environment");
        this.skip();
      }

      // Deploy with short duration
      voting = await ethers.deployContract("HiddenVoting", [PROPOSAL, 10]);

      // Cast votes: 2 Yes, 1 No
      const enc1 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1) // Yes
        .encrypt();
      await voting.connect(voter1).vote(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter2.address)
        .add8(0) // No
        .encrypt();
      await voting.connect(voter2).vote(enc2.handles[0], enc2.inputProof);

      const enc3 = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter3.address)
        .add8(1) // Yes
        .encrypt();
      await voting.connect(voter3).vote(enc3.handles[0], enc3.inputProof);

      // Wait and close voting
      await new Promise((resolve) => setTimeout(resolve, 11000));
      await hre.network.provider.send("evm_increaseTime", [12]);
      await hre.network.provider.send("evm_mine");

      await voting.connect(owner).closeVoting();

      // Get encrypted results
      const encYes = await voting.getEncryptedYesVotes();
      const encNo = await voting.getEncryptedNoVotes();

      // 🔓 Revelation Process (Public Decryption):
      // 1. Request decryption for the aggregated Yes and No vote counts.
      const handles = [encYes, encNo];
      const decryptResults = await fhevm.publicDecrypt(handles);

      // 2. Reveal results on-chain by providing the clear tallies and the KMS proof.
      await voting.revealResults(
        decryptResults.abiEncodedClearValues,
        decryptResults.decryptionProof
      );

      // Verify results
      expect(await voting.votingState()).to.equal(2); // Revealed
      expect(await voting.revealedYesVotes()).to.equal(2n);
      expect(await voting.revealedNoVotes()).to.equal(1n);
      expect(await voting.hasPassed()).to.be.true;

      console.log(`✅ Proposal: ${await voting.proposal()}`);
      console.log(`📊 Yes: ${await voting.revealedYesVotes()}`);
      console.log(`📊 No: ${await voting.revealedNoVotes()}`);
      console.log(`🏆 Passed: ${await voting.hasPassed()}`);
    });

    it("should handle unanimous No votes", async function () {
      if (!hre.fhevm.isMock) {
        this.skip();
      }

      voting = await ethers.deployContract("HiddenVoting", [PROPOSAL, 10]);

      // All vote No
      for (const voter of [voter1, voter2, voter3]) {
        const enc = await fhevm
          .createEncryptedInput(await voting.getAddress(), voter.address)
          .add8(0)
          .encrypt();
        await voting.connect(voter).vote(enc.handles[0], enc.inputProof);
      }

      await new Promise((resolve) => setTimeout(resolve, 11000));
      await hre.network.provider.send("evm_increaseTime", [12]);
      await hre.network.provider.send("evm_mine");

      await voting.connect(owner).closeVoting();

      const encYes = await voting.getEncryptedYesVotes();
      const encNo = await voting.getEncryptedNoVotes();
      const decryptResults = await fhevm.publicDecrypt([encYes, encNo]);

      await voting.revealResults(
        decryptResults.abiEncodedClearValues,
        decryptResults.decryptionProof
      );

      expect(await voting.revealedYesVotes()).to.equal(0n);
      expect(await voting.revealedNoVotes()).to.equal(3n);
      expect(await voting.hasPassed()).to.be.false;
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    beforeEach(async function () {
      voting = await deployVoting(3600);
    });

    it("should reject vote after voting closes", async function () {
      // Fast forward past end time
      await hre.network.provider.send("evm_increaseTime", [3601]);
      await hre.network.provider.send("evm_mine");

      await voting.connect(owner).closeVoting();

      const encryptedVote = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1)
        .encrypt();

      await expect(
        voting
          .connect(voter1)
          .vote(encryptedVote.handles[0], encryptedVote.inputProof)
      ).to.be.revertedWith("Voting not active");
    });

    it("should allow closing with no votes", async function () {
      // Contract allows closing with no votes
      await hre.network.provider.send("evm_increaseTime", [3601]);
      await hre.network.provider.send("evm_mine");

      await expect(voting.connect(owner).closeVoting()).to.not.be.reverted;
    });

    it("should reject reveal before closing", async function () {
      // Cast a vote
      const enc = await fhevm
        .createEncryptedInput(await voting.getAddress(), voter1.address)
        .add8(1)
        .encrypt();
      await voting.connect(voter1).vote(enc.handles[0], enc.inputProof);

      // Try to reveal without closing
      await expect(voting.revealResults("0x", "0x")).to.be.revertedWith(
        "Voting not closed"
      );
    });
  });
});
