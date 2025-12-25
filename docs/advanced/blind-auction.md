Blind auction where bids remain fully encrypted until the end. Uses FHE.gt/select to find the winner without decrypting losing bids. Only the winning amount is revealed after the auction closes.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (12 items)</summary>

**Types:** `ebool` · `euint64` · `externalEuint64`

**Functions:**
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint64()` - Encrypts a plaintext uint64 value into euint64
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.ge()` - Encrypted greater-or-equal: returns ebool(a >= b)
- `FHE.gt()` - Encrypted greater-than: returns ebool(a > b)
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false
- `FHE.toBytes32()` - Converts encrypted handle to bytes32 for proof arrays

</details>

{% tabs %}

{% tab title="BlindAuction.sol" %}

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
 * @notice Blind auction where bids remain fully encrypted until the end.
 *         Uses FHE.gt/select to find the winner without decrypting losing bids.
 *         Only the winning amount is revealed after the auction closes.

 * @dev Flow: bid() → endAuction() → revealWinner()
 *      Uses FHE.gt/select to find winner without revealing losing bids.
 */
contract BlindAuction is ZamaEthereumConfig {
    enum AuctionState {
        Open, // Accepting bids
        Closed, // Bidding ended, pending reveal
        Revealed // Winner revealed on-chain
    }

    /// Auction owner (deployer)
    address public owner;

    /// Current auction state
    AuctionState public auctionState;

    /// Minimum bid in plaintext (for gas efficiency)
    uint64 public minimumBid;

    /// Auction end timestamp
    uint256 public endTime;

    /// All bidder addresses (for iteration)
    address[] public bidders;

    /// Mapping from bidder address to their encrypted bid
    mapping(address => euint64) private _bids;

    /// Whether an address has bid
    mapping(address => bool) public hasBid;

    /// Encrypted winning bid amount (set after auction ends)
    euint64 private _winningBid;

    /// Encrypted winner index in bidders array
    euint64 private _winnerIndex;

    /// Address of the winner (set after reveal)
    address public winner;

    /// Revealed winning amount (set after reveal)
    uint64 public winningAmount;

    /// @notice Emitted when a new bid is placed
    /// @param bidder Address of the bidder
    event BidPlaced(address indexed bidder);

    /// @notice Emitted when auction is closed
    /// @param encryptedWinningBid Handle for encrypted winning bid
    /// @param encryptedWinnerIndex Handle for encrypted winner index
    event AuctionEnded(
        euint64 encryptedWinningBid,
        euint64 encryptedWinnerIndex
    );

    /// @notice Emitted when winner is revealed
    /// @param winner Address of the winner
    /// @param amount Winning bid amount
    event WinnerRevealed(address indexed winner, uint64 amount);

    /// @dev Restricts function to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call");
        _;
    }

    /// @notice Creates a new blind auction
    /// @param _endTime Unix timestamp when bidding ends
    /// @param _minimumBid Minimum bid amount (plaintext)
    constructor(uint256 _endTime, uint64 _minimumBid) {
        require(_endTime > block.timestamp, "End time must be in future");
        owner = msg.sender;
        endTime = _endTime;
        minimumBid = _minimumBid;
        auctionState = AuctionState.Open;
    }

    /// @notice Submit an encrypted bid to the auction
    /// @dev Each address can only bid once
    /// @param inputProof Proof validating the encrypted input
    function bid(
        externalEuint64 encryptedBid,
        bytes calldata inputProof
    ) external {
        require(auctionState == AuctionState.Open, "Auction not open");
        require(block.timestamp < endTime, "Auction has ended");
        require(!hasBid[msg.sender], "Already placed a bid");

        // Convert external encrypted input to internal handle (proof verified)
        euint64 bidAmount = FHE.fromExternal(encryptedBid, inputProof);
        FHE.allowThis(bidAmount);

        // Store bid - amount stays encrypted
        _bids[msg.sender] = bidAmount;
        hasBid[msg.sender] = true;
        bidders.push(msg.sender);

        emit BidPlaced(msg.sender);
    }

    /// @notice End the auction and compute the winner
    /// @dev ⚡ Gas: O(n) loop with FHE.gt/select. ~200k gas per bidder!
    /// @dev Only owner can call after end time
    function endAuction() external onlyOwner {
        require(auctionState == AuctionState.Open, "Auction not open");
        require(block.timestamp >= endTime, "Auction not yet ended");
        require(bidders.length > 0, "No bids placed");

        // Find winner using encrypted comparisons (no bids revealed!)
        euint64 currentMax = _bids[bidders[0]];
        euint64 currentWinnerIdx = FHE.asEuint64(0);

        for (uint256 i = 1; i < bidders.length; i++) {
            euint64 candidateBid = _bids[bidders[i]];

            // 🔀 Why select? if/else would leak which bid is higher!
            // Losing bids remain encrypted forever
            ebool isGreater = FHE.gt(candidateBid, currentMax);
            currentMax = FHE.select(isGreater, candidateBid, currentMax);
            currentWinnerIdx = FHE.select(
                isGreater,
                FHE.asEuint64(uint64(i)),
                currentWinnerIdx
            );
        }

        // Check minimum bid (comparison stays encrypted)
        ebool meetsMinimum = FHE.ge(currentMax, FHE.asEuint64(minimumBid));
        _winningBid = FHE.select(meetsMinimum, currentMax, FHE.asEuint64(0));
        _winnerIndex = currentWinnerIdx;

        // Mark for public decryption via KMS relayer
        FHE.allowThis(_winningBid);
        FHE.allowThis(_winnerIndex);
        FHE.makePubliclyDecryptable(_winningBid);
        FHE.makePubliclyDecryptable(_winnerIndex);

        auctionState = AuctionState.Closed;

        emit AuctionEnded(_winningBid, _winnerIndex);
    }

    /// @notice Reveal the winner with KMS decryption proof
    /// @dev Anyone can call once relayer provides proof.
    ///      ⚠️ Order matters! cts[] must match abi.decode() order.
    function revealWinner(
        bytes memory abiEncodedResults,
        bytes memory decryptionProof
    ) external {
        require(auctionState == AuctionState.Closed, "Auction not closed");

        // Build handle array - order must match abi.decode() below!
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_winningBid);
        cts[1] = FHE.toBytes32(_winnerIndex);

        // Verify KMS signatures (reverts if proof invalid)
        FHE.checkSignatures(cts, abiEncodedResults, decryptionProof);

        // Decode verified plaintext results
        (uint64 revealedAmount, uint64 winnerIdx) = abi.decode(
            abiEncodedResults,
            (uint64, uint64)
        );

        if (revealedAmount >= minimumBid && winnerIdx < bidders.length) {
            winner = bidders[winnerIdx];
            winningAmount = revealedAmount;
        } else {
            winner = address(0);
            winningAmount = 0;
        }

        auctionState = AuctionState.Revealed;

        emit WinnerRevealed(winner, winningAmount);
    }

    /// @notice Get the number of bidders
    function getBidderCount() external view returns (uint256) {
        return bidders.length;
    }

    /// @notice Get bidder address by index
    function getBidder(uint256 index) external view returns (address) {
        require(index < bidders.length, "Index out of bounds");
        return bidders[index];
    }

    /// @notice Get encrypted winning bid handle (after auction ends)
    function getEncryptedWinningBid() external view returns (euint64) {
        require(auctionState != AuctionState.Open, "Auction still open");
        return _winningBid;
    }

    /// @notice Get encrypted winner index handle (after auction ends)
    function getEncryptedWinnerIndex() external view returns (euint64) {
        require(auctionState != AuctionState.Open, "Auction still open");
        return _winnerIndex;
    }
}

```

{% endtab %}

{% tab title="BlindAuction.ts" %}

```typescript
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import * as hre from "hardhat";

/**
 * Blind Auction Tests
 *
 * Tests the private bidding process and winner determination using FHE.
 * Validates bid privacy during the auction and public disclosure of results after closing.
 */
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
      // 🔐 Encrypt the bid locally:
      // We use `add64` because the contract expects a `euint64` handle.
      const encryptedBid = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(500)
        .encrypt();

      // 🚀 Submit the encrypted bid handle and proof:
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

      // 🔓 Revelation Process (Public Decryption):
      // 1. Request decryption for the winning bid and winner's index.
      const handles = [encWinningBid, encWinnerIndex];
      const decryptResults = await fhevm.publicDecrypt(handles);

      // 2. Reveal winner on-chain by providing the clear results and the KMS proof.
      await auction.revealWinner(
        decryptResults.abiEncodedClearValues,
        decryptResults.decryptionProof
      );

      // 🛡️ Verify final public state
      expect(await auction.auctionState()).to.equal(2); // Revealed
      expect(await auction.winner()).to.equal(bidder2.address);
      expect(await auction.winningAmount()).to.equal(500n);

      console.log(`🏆 Winner: ${await auction.winner()}`);
      console.log(`💰 Winning Amount: ${await auction.winningAmount()}`);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    beforeEach(async function () {
      const deployment = await deployAuction(3600);
      auction = deployment.auction;
    });

    it("should accept minimum bid (boundary test)", async function () {
      const encryptedBid = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(Number(MINIMUM_BID)) // Exactly minimum
        .encrypt();

      await expect(
        auction
          .connect(bidder1)
          .bid(encryptedBid.handles[0], encryptedBid.inputProof)
      ).to.not.be.reverted;

      expect(await auction.hasBid(bidder1.address)).to.be.true;
    });

    it("should reject bid after auction ends", async function () {
      // Fast forward past end time
      await hre.network.provider.send("evm_increaseTime", [3601]);
      await hre.network.provider.send("evm_mine");

      const encryptedBid = await fhevm
        .createEncryptedInput(await auction.getAddress(), bidder1.address)
        .add64(500)
        .encrypt();

      await expect(
        auction
          .connect(bidder1)
          .bid(encryptedBid.handles[0], encryptedBid.inputProof)
      ).to.be.revertedWith("Auction has ended");
    });

    it("should handle auction with no bids", async function () {
      // End auction without any bids
      await hre.network.provider.send("evm_increaseTime", [3601]);
      await hre.network.provider.send("evm_mine");

      await expect(auction.connect(owner).endAuction()).to.be.revertedWith(
        "No bids placed"
      );
    });
  });
});

```

{% endtab %}

{% endtabs %}
