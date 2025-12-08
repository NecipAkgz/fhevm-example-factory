import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import * as hre from "hardhat";

describe("BlindAuction", function () {
  let auction: any;
  let owner: any;
  let bidder1: any;
  let bidder2: any;
  let bidder3: any;

  const MINIMUM_BID = 100n;

  async function deployAuction(durationSeconds: number = 60) {
    // Get blockchain timestamp instead of Date.now()
    const latestBlock = await ethers.provider.getBlock("latest");
    const endTime =
      (latestBlock?.timestamp || Math.floor(Date.now() / 1000)) +
      durationSeconds;
    const auctionContract = await ethers.deployContract("BlindAuction", [
      endTime,
      MINIMUM_BID,
    ]);
    return { auction: auctionContract, endTime };
  }

  beforeEach(async function () {
    [owner, bidder1, bidder2, bidder3] = await ethers.getSigners();
  });

  describe("Auction Creation", function () {
    it("should create auction with correct parameters", async function () {
      const { auction: auc } = await deployAuction(120);

      expect(await auc.auctionState()).to.equal(0); // Open
      expect(await auc.minimumBid()).to.equal(MINIMUM_BID);
      expect(await auc.getBidderCount()).to.equal(0);
    });

    it("should revert if end time is in the past", async function () {
      const pastTime = Math.floor(Date.now() / 1000) - 100;
      await expect(
        ethers.deployContract("BlindAuction", [pastTime, MINIMUM_BID])
      ).to.be.revertedWith("End time must be in future");
    });
  });

  describe("Bidding", function () {
    beforeEach(async function () {
      const deployment = await deployAuction(3600); // 1 hour
      auction = deployment.auction;
    });

    it("should accept encrypted bid", async function () {
      const encryptedBid = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(500)
        .encrypt();

      await expect(
        auction
          .connect(bidder1)
          .bid(encryptedBid.handles[0], encryptedBid.inputProof)
      ).to.not.be.reverted;

      expect(await auction.hasBid(bidder1.address)).to.be.true;
      expect(await auction.getBidderCount()).to.equal(1);
    });

    it("should reject second bid from same address", async function () {
      const encryptedBid1 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(500)
        .encrypt();

      await auction
        .connect(bidder1)
        .bid(encryptedBid1.handles[0], encryptedBid1.inputProof);

      const encryptedBid2 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(600)
        .encrypt();

      await expect(
        auction
          .connect(bidder1)
          .bid(encryptedBid2.handles[0], encryptedBid2.inputProof)
      ).to.be.revertedWith("Already placed a bid");
    });

    it("should accept bids from multiple bidders", async function () {
      // Bidder 1
      const enc1 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(200)
        .encrypt();
      await auction.connect(bidder1).bid(enc1.handles[0], enc1.inputProof);

      // Bidder 2
      const enc2 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder2.address)
        .add64(300)
        .encrypt();
      await auction.connect(bidder2).bid(enc2.handles[0], enc2.inputProof);

      // Bidder 3
      const enc3 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder3.address)
        .add64(150)
        .encrypt();
      await auction.connect(bidder3).bid(enc3.handles[0], enc3.inputProof);

      expect(await auction.getBidderCount()).to.equal(3);
    });
  });

  describe("End Auction", function () {
    beforeEach(async function () {
      // Deploy with 1 hour duration to avoid timing issues from evm_increaseTime in other tests
      const deployment = await deployAuction(3600);
      auction = deployment.auction;

      // Place bids before it ends
      const enc1 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(200)
        .encrypt();
      await auction.connect(bidder1).bid(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder2.address)
        .add64(500)
        .encrypt();
      await auction.connect(bidder2).bid(enc2.handles[0], enc2.inputProof);

      const enc3 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder3.address)
        .add64(300)
        .encrypt();
      await auction.connect(bidder3).bid(enc3.handles[0], enc3.inputProof);
    });

    it("should not allow ending before time", async function () {
      await expect(auction.connect(owner).endAuction()).to.be.revertedWith(
        "Auction not yet ended"
      );
    });

    it("should allow owner to end after time passes", async function () {
      // Fast forward time past auction end
      await hre.network.provider.send("evm_increaseTime", [3601]);
      await hre.network.provider.send("evm_mine");

      await expect(auction.connect(owner).endAuction()).to.not.be.reverted;
      expect(await auction.auctionState()).to.equal(1); // Closed
    });

    it("should not allow non-owner to end auction", async function () {
      await hre.network.provider.send("evm_increaseTime", [3601]);
      await hre.network.provider.send("evm_mine");

      await expect(auction.connect(bidder1).endAuction()).to.be.revertedWith(
        "Only owner can call"
      );
    });
  });

  describe("Full Auction Flow", function () {
    it("should correctly identify highest bidder", async function () {
      // Check if running in mock mode
      if (!hre.fhevm.isMock) {
        console.log("Skipping: Test requires mock environment");
        this.skip();
      }

      // Deploy with short duration - use blockchain timestamp
      const latestBlock = await ethers.provider.getBlock("latest");
      const endTime = (latestBlock?.timestamp || 0) + 60; // 60 seconds from now
      auction = await ethers.deployContract("BlindAuction", [
        endTime,
        MINIMUM_BID,
      ]);

      // Place bids: bidder2 has highest (500)
      const enc1 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(200)
        .encrypt();
      await auction.connect(bidder1).bid(enc1.handles[0], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder2.address)
        .add64(500) // 🏆 Highest bid
        .encrypt();
      await auction.connect(bidder2).bid(enc2.handles[0], enc2.inputProof);

      const enc3 = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder3.address)
        .add64(300)
        .encrypt();
      await auction.connect(bidder3).bid(enc3.handles[0], enc3.inputProof);

      // Fast forward time using evm commands
      await hre.network.provider.send("evm_increaseTime", [65]); // 65 seconds
      await hre.network.provider.send("evm_mine");

      const endTx = await auction.connect(owner).endAuction();
      const endReceipt = await endTx.wait();

      // Parse AuctionEnded event to get encrypted handles
      const auctionEndedEvent = endReceipt.logs.find((log: any) => {
        try {
          const parsed = auction.interface.parseLog(log);
          return parsed?.name === "AuctionEnded";
        } catch {
          return false;
        }
      });

      expect(auctionEndedEvent).to.not.be.undefined;

      // Get encrypted handles from contract
      const encWinningBid = await auction.getEncryptedWinningBid();
      const encWinnerIndex = await auction.getEncryptedWinnerIndex();

      // Request public decryption
      const handles = [encWinningBid, encWinnerIndex];
      const decryptResults = await fhevm.publicDecrypt(handles);

      // Reveal winner
      await auction.revealWinner(
        decryptResults.abiEncodedClearValues,
        decryptResults.decryptionProof
      );

      // Verify results
      expect(await auction.auctionState()).to.equal(2); // Revealed
      expect(await auction.winner()).to.equal(bidder2.address);
      expect(await auction.winningAmount()).to.equal(500n);

      console.log(`🏆 Winner: ${await auction.winner()}`);
      console.log(`💰 Winning Amount: ${await auction.winningAmount()}`);
    });
  });
});
