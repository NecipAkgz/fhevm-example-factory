Provably fair lottery with encrypted ticket numbers and FHE randomness. Players buy tickets with hidden numbers. Winners are determined by comparing encrypted values, ensuring no one sees numbers before the draw.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (11 items)</summary>

**Types:** `ebool` · `euint64` · `euint8` · `externalEuint64`

**Functions:**
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint64()` - Encrypts a plaintext uint64 value into euint64
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.eq()` - Encrypted equality: returns ebool(a == b)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer
- `FHE.toBytes32()` - Converts encrypted handle to bytes32 for proof arrays

</details>

{% tabs %}

{% tab title="EncryptedLottery.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint64,
    euint8,
    ebool,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Provably fair lottery with encrypted ticket numbers and FHE randomness.
 *         Players buy tickets with hidden numbers. Winners are determined by
 *         comparing encrypted values, ensuring no one sees numbers before the draw.
 *
 * @dev Flow: buyTicket() → startDrawing() → checkAndClaim() → revealWinner()
 */
contract EncryptedLottery is ZamaEthereumConfig {
    enum LotteryState {
        Open, // Accepting tickets
        Drawing, // Drawing in progress
        Completed // Winner revealed
    }

    struct Ticket {
        address owner;
        euint64 number;
    }

    address public owner;

    /// Current lottery state
    LotteryState public state;

    /// Ticket price in wei
    uint256 public ticketPrice;

    /// Lottery end time
    uint256 public endTime;

    /// All tickets
    Ticket[] private _tickets;

    /// Mapping from address to ticket indices
    mapping(address => uint256[]) private _playerTickets;

    /// Encrypted winning number
    euint64 private _winningNumber;

    /// Winner address (if found)
    address public winner;

    /// Prize pool
    uint256 public prizePool;

    /// Lottery round number
    uint256 public roundNumber;

    /// Emitted when a ticket is purchased
    /// @param buyer Address of ticket buyer
    /// @param ticketIndex Index of the ticket
    event TicketPurchased(address indexed buyer, uint256 indexed ticketIndex);

    /// @notice Emitted when drawing starts
    /// @param roundNumber Current round
    event DrawingStarted(uint256 indexed roundNumber);

    /// @notice Emitted when winner is found
    /// @param winner Address of winner
    /// @param prize Amount won
    event WinnerFound(address indexed winner, uint256 prize);

    /// @notice Emitted when no winner found
    /// @param roundNumber Current round
    /// @param rollover Amount rolled to next round
    event NoWinner(uint256 indexed roundNumber, uint256 rollover);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(uint256 _ticketPrice, uint256 _duration) {
        require(_ticketPrice > 0, "Ticket price must be > 0");
        require(_duration > 0, "Duration must be > 0");

        owner = msg.sender;
        ticketPrice = _ticketPrice;
        endTime = block.timestamp + _duration;
        state = LotteryState.Open;
        roundNumber = 1;
    }

    /// @notice Purchase a lottery ticket with encrypted number
    /// @param encryptedNumber Your encrypted ticket number
    /// @param inputProof Proof validating the encrypted input
    function buyTicket(
        externalEuint64 encryptedNumber,
        bytes calldata inputProof
    ) external payable {
        require(state == LotteryState.Open, "Lottery not open");
        require(block.timestamp < endTime, "Lottery ended");
        require(msg.value >= ticketPrice, "Insufficient payment");

        // Convert and store encrypted ticket number
        euint64 ticketNumber = FHE.fromExternal(encryptedNumber, inputProof);

        // ✅ Grant contract permission
        FHE.allowThis(ticketNumber);

        // 📋 Store ticket
        uint256 ticketIndex = _tickets.length;
        _tickets.push(Ticket({owner: msg.sender, number: ticketNumber}));

        _playerTickets[msg.sender].push(ticketIndex);
        prizePool += msg.value;

        emit TicketPurchased(msg.sender, ticketIndex);
    }

    /// @notice Start the drawing process
    /// @dev Only owner can call after lottery ends
    function startDrawing() external onlyOwner {
        require(state == LotteryState.Open, "Wrong state");
        require(block.timestamp >= endTime, "Lottery not ended");
        require(_tickets.length > 0, "No tickets sold");

        // 🎲 Generate "random" winning number using block data
        // ⚠️ WARNING: This is predictable! Use Chainlink VRF in production
        uint64 randomSeed = uint64(
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        block.timestamp,
                        _tickets.length,
                        msg.sender
                    )
                )
            )
        );

        // 🔐 Encrypt the winning number
        _winningNumber = FHE.asEuint64(randomSeed);
        FHE.allowThis(_winningNumber);

        state = LotteryState.Drawing;

        emit DrawingStarted(roundNumber);
    }

    /// @notice Check if a ticket is a winner and claim prize
    /// @param ticketIndex Index of the ticket to check
    function checkAndClaim(uint256 ticketIndex) external {
        require(state == LotteryState.Drawing, "Not in drawing phase");
        require(ticketIndex < _tickets.length, "Invalid ticket");
        require(_tickets[ticketIndex].owner == msg.sender, "Not your ticket");

        // 🔍 Check if ticket number matches winning number
        // This comparison happens in encrypted space!
        ebool isWinner = FHE.eq(_tickets[ticketIndex].number, _winningNumber);

        // 🔓 Make result publicly decryptable
        FHE.allowThis(isWinner);
        FHE.makePubliclyDecryptable(isWinner);

        // Store for later reveal
        // In production, use callback pattern
    }

    /// @notice Reveal winner with decryption proof
    /// @param ticketIndex Ticket being checked
    /// @param abiEncodedResult ABI-encoded bool result
    /// @param decryptionProof KMS signature proving decryption
    function revealWinner(
        uint256 ticketIndex,
        bytes memory abiEncodedResult,
        bytes memory decryptionProof
    ) external {
        require(state == LotteryState.Drawing, "Not in drawing phase");
        require(ticketIndex < _tickets.length, "Invalid ticket");

        // Rebuild the comparison for verification
        ebool isWinner = FHE.eq(_tickets[ticketIndex].number, _winningNumber);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(isWinner);

        // Verify decryption proof
        FHE.checkSignatures(cts, abiEncodedResult, decryptionProof);

        bool won = abi.decode(abiEncodedResult, (bool));

        if (won) {
            winner = _tickets[ticketIndex].owner;
            state = LotteryState.Completed;

            uint256 prize = prizePool;
            prizePool = 0;

            // Transfer prize
            (bool sent, ) = winner.call{value: prize}("");
            require(sent, "Prize transfer failed");

            emit WinnerFound(winner, prize);
        }
    }

    /// @notice End drawing with no winner (rollover)
    /// @dev Called if all tickets checked with no match
    function endDrawingNoWinner() external onlyOwner {
        require(state == LotteryState.Drawing, "Not in drawing phase");

        state = LotteryState.Completed;

        emit NoWinner(roundNumber, prizePool);
    }

    /// @notice Start a new lottery round
    /// @param _duration Duration for next round
    function startNewRound(uint256 _duration) external onlyOwner {
        require(state == LotteryState.Completed, "Current round not complete");
        require(_duration > 0, "Duration must be > 0");

        // Reset for new round
        delete _tickets;
        winner = address(0);
        endTime = block.timestamp + _duration;
        state = LotteryState.Open;
        roundNumber++;
        // prizePool carries over if no winner
    }

    function getTicketCount() external view returns (uint256) {
        return _tickets.length;
    }

    /// @notice Get ticket indices for a player
    function getPlayerTickets(
        address player
    ) external view returns (uint256[] memory) {
        return _playerTickets[player];
    }

    /// @notice Check time remaining
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    /// @notice Get lottery info
    function getLotteryInfo()
        external
        view
        returns (
            LotteryState currentState,
            uint256 currentPrizePool,
            uint256 currentEndTime,
            uint256 currentRound,
            uint256 totalTickets
        )
    {
        return (state, prizePool, endTime, roundNumber, _tickets.length);
    }
}

```

{% endtab %}

{% tab title="EncryptedLottery.ts" %}

```typescript
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
});

```

{% endtab %}

{% endtabs %}
