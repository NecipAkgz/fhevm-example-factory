On-chain Texas Hold'em poker with encrypted hole cards and hand strengths. Hole cards remain hidden throughout. Winners are determined by comparing encrypted hand strengths, demonstrating complex multi-state game logic.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (13 items)</summary>

**Types:** `ebool` · `euint16` · `euint8` · `externalEuint8`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint16()` - Encrypts a plaintext uint16 value into euint16
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.gt()` - Encrypted greater-than: returns ebool(a > b)
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer
- `FHE.toBytes32()` - Converts encrypted handle to bytes32 for proof arrays

</details>

{% tabs %}

{% tab title="EncryptedPoker.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint8,
    euint16,
    ebool,
    externalEuint8
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice On-chain Texas Hold'em poker with encrypted hole cards and hand strengths.
 *         Hole cards remain hidden throughout. Winners are determined by comparing
 *         encrypted hand strengths, demonstrating complex multi-state game logic.
 *
 * @dev Flow: joinGame() → bet()/fold() → showdown() → revealWinner()
 */
contract EncryptedPoker is ZamaEthereumConfig {
    enum GameState {
        WaitingForPlayers, // Waiting for 2 players
        CardsDealt, // Both players have cards
        BettingRound, // Players can bet
        Showdown, // Comparing hands
        Finished // Winner determined
    }

    struct Player {
        address addr;
        euint8 card1;
        euint8 card2;
        euint16 handStrength; // card1 + card2 for simplified ranking
        uint256 bet;
        bool folded;
    }

    /// Game state
    GameState public state;

    /// Players (0 and 1)
    Player[2] private _players;

    /// Current pot
    uint256 public pot;

    /// Minimum bet
    uint256 public minBet;

    /// Winner address (set after showdown)
    address public winner;

    /// Game ID
    uint256 public gameId;

    /// Encrypted comparison result (true if player 0 wins)
    ebool private _player0Wins;

    /// @notice Emitted when a player joins
    /// @param player Address of joining player
    /// @param seat Seat number (0 or 1)
    event PlayerJoined(address indexed player, uint8 seat);

    /// @notice Emitted when cards are dealt
    event CardsDealt();

    /// @notice Emitted when a bet is placed
    /// @param player Address of betting player
    /// @param amount Bet amount
    event BetPlaced(address indexed player, uint256 amount);

    /// @notice Emitted when a player folds
    /// @param player Address of folding player
    event PlayerFolded(address indexed player);

    /// @notice Emitted when showdown begins
    event ShowdownStarted();

    /// @notice Emitted when winner is determined
    /// @param winner Address of winner
    /// @param pot Total pot won
    event GameWon(address indexed winner, uint256 pot);

    /// @notice Creates a new poker game
    /// @param _minBet Minimum bet amount in wei
    constructor(uint256 _minBet) {
        require(_minBet > 0, "Min bet must be > 0");
        minBet = _minBet;
        gameId = 1;
        state = GameState.WaitingForPlayers;
    }

    /// @notice Join the game with encrypted hole cards
    /// @param encCard1 First encrypted card (1-13)
    /// @param encCard2 Second encrypted card (1-13)
    /// @param inputProof Proof validating encrypted inputs
    function joinGame(
        externalEuint8 encCard1,
        externalEuint8 encCard2,
        bytes calldata inputProof
    ) external payable {
        require(
            state == GameState.WaitingForPlayers,
            "Game not accepting players"
        );
        require(msg.value >= minBet, "Must pay min bet to join");
        require(
            _players[0].addr != msg.sender && _players[1].addr != msg.sender,
            "Already in game"
        );

        // 🔐 Convert encrypted cards
        euint8 card1 = FHE.fromExternal(encCard1, inputProof);
        euint8 card2 = FHE.fromExternal(encCard2, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(card1);
        FHE.allowThis(card2);
        FHE.allow(card1, msg.sender); // Player can see own cards
        FHE.allow(card2, msg.sender);

        // 🧮 Compute hand strength (simplified: sum of cards)
        euint16 strength = FHE.add(FHE.asEuint16(card1), FHE.asEuint16(card2));
        FHE.allowThis(strength);

        uint8 seat;
        if (_players[0].addr == address(0)) {
            seat = 0;
            _players[0] = Player({
                addr: msg.sender,
                card1: card1,
                card2: card2,
                handStrength: strength,
                bet: msg.value,
                folded: false
            });
        } else {
            seat = 1;
            _players[1] = Player({
                addr: msg.sender,
                card1: card1,
                card2: card2,
                handStrength: strength,
                bet: msg.value,
                folded: false
            });
            // Both players joined
            state = GameState.CardsDealt;
            emit CardsDealt();
        }

        pot += msg.value;
        emit PlayerJoined(msg.sender, seat);
    }

    /// @notice Place a bet
    function bet() external payable {
        require(
            state == GameState.CardsDealt || state == GameState.BettingRound,
            "Not betting phase"
        );
        require(msg.value > 0, "Must bet something");

        uint8 seat = _getSeat(msg.sender);
        require(!_players[seat].folded, "Already folded");

        _players[seat].bet += msg.value;
        pot += msg.value;
        state = GameState.BettingRound;

        emit BetPlaced(msg.sender, msg.value);
    }

    /// @notice Fold your hand
    function fold() external {
        require(
            state == GameState.CardsDealt || state == GameState.BettingRound,
            "Not betting phase"
        );

        uint8 seat = _getSeat(msg.sender);
        require(!_players[seat].folded, "Already folded");

        _players[seat].folded = true;

        // Other player wins by default
        uint8 winnerSeat = seat == 0 ? 1 : 0;
        winner = _players[winnerSeat].addr;
        state = GameState.Finished;

        // Transfer pot to winner
        uint256 winnings = pot;
        pot = 0;
        (bool sent, ) = winner.call{value: winnings}("");
        require(sent, "Transfer failed");

        emit PlayerFolded(msg.sender);
        emit GameWon(winner, winnings);
    }

    /// @notice Initiate showdown - compare hands using FHE
    function showdown() external {
        require(
            state == GameState.CardsDealt || state == GameState.BettingRound,
            "Not ready for showdown"
        );
        require(!_players[0].folded && !_players[1].folded, "Someone folded");

        // 🎯 Compare hand strengths using FHE
        _player0Wins = FHE.gt(
            _players[0].handStrength,
            _players[1].handStrength
        );

        FHE.allowThis(_player0Wins);
        FHE.makePubliclyDecryptable(_player0Wins);

        state = GameState.Showdown;
        emit ShowdownStarted();
    }

    /// @notice Reveal winner with decryption proof
    /// @param abiEncodedResult ABI-encoded bool result
    /// @param decryptionProof KMS signature proving decryption
    function revealWinner(
        bytes memory abiEncodedResult,
        bytes memory decryptionProof
    ) external {
        require(state == GameState.Showdown, "Not showdown phase");

        // Verify decryption
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(_player0Wins);
        FHE.checkSignatures(cts, abiEncodedResult, decryptionProof);

        bool player0Wins = abi.decode(abiEncodedResult, (bool));

        if (player0Wins) {
            winner = _players[0].addr;
        } else {
            winner = _players[1].addr;
        }

        state = GameState.Finished;

        // Transfer pot
        uint256 winnings = pot;
        pot = 0;
        (bool sent, ) = winner.call{value: winnings}("");
        require(sent, "Transfer failed");

        emit GameWon(winner, winnings);
    }

    /// @notice Reset for a new game
    function resetGame() external {
        require(state == GameState.Finished, "Game not finished");

        delete _players[0];
        delete _players[1];
        pot = 0;
        winner = address(0);
        state = GameState.WaitingForPlayers;
        gameId++;
    }

    /// @notice Get game info
    function getGameInfo()
        external
        view
        returns (
            GameState currentState,
            address player0,
            address player1,
            uint256 currentPot,
            address currentWinner,
            uint256 currentGameId
        )
    {
        return (state, _players[0].addr, _players[1].addr, pot, winner, gameId);
    }

    /// @notice Get player bet
    function getPlayerBet(address player) external view returns (uint256) {
        if (_players[0].addr == player) return _players[0].bet;
        if (_players[1].addr == player) return _players[1].bet;
        return 0;
    }

    /// @notice Check if address is in game
    function isPlayer(address addr) external view returns (bool) {
        return _players[0].addr == addr || _players[1].addr == addr;
    }

    /// @notice Get own cards (only callable by the player themselves)
    /// @dev Returns encrypted handles that only the caller can decrypt
    function getMyCards() external view returns (euint8 card1, euint8 card2) {
        uint8 seat = _getSeat(msg.sender);
        return (_players[seat].card1, _players[seat].card2);
    }

    function _getSeat(address player) internal view returns (uint8) {
        if (_players[0].addr == player) return 0;
        if (_players[1].addr == player) return 1;
        revert("Not a player");
    }
}

```

{% endtab %}

{% tab title="EncryptedPoker.ts" %}

```typescript
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
      // 🔐 Encrypt hole cards locally:
      // Hole cards are private to each player. Here, Player 0 has King (13) and Queen (12).
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

    it("should allow player to place a bet", async function () {
      const betAmount = ethers.parseEther("0.05");
      // 🚀 Placing a Bet:
      // Players can bet based on their private knowledge of their hole cards.
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
      // 🛡️ Showdown Phase:
      // Once betting is over, the contract compares the encrypted cards of both players.
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

```

{% endtab %}

{% endtabs %}
