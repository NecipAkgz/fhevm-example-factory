On-chain Blackjack with encrypted cards and FHE-based hand comparison. Player and dealer cards remain hidden. Hand sums are computed using FHE, demonstrating multi-card aggregation and bust detection patterns.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (17 items)</summary>

**Types:** `ebool` · `euint16` · `euint8` · `externalEuint8`

**Functions:**
- `FHE.add()` - Homomorphic addition: result = a + b (overflow wraps)
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.and()` - Homomorphic bitwise AND
- `FHE.asEuint16()` - Encrypts a plaintext uint16 value into euint16
- `FHE.asEuint8()` - Encrypts a plaintext uint8 value into euint8
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.gt()` - Encrypted greater-than: returns ebool(a > b)
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer
- `FHE.not()` - Homomorphic bitwise NOT
- `FHE.or()` - Homomorphic bitwise OR
- `FHE.toBytes32()` - Converts encrypted handle to bytes32 for proof arrays

</details>

{% tabs %}

{% tab title="EncryptedBlackjack.sol" %}

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
 * @notice On-chain Blackjack with encrypted cards and FHE-based hand comparison.
 *         Player and dealer cards remain hidden. Hand sums are computed using FHE,
 *         demonstrating multi-card aggregation and bust detection patterns.
 *
 * @dev Flow: startGame() → hit()/stand() → dealerPlay() → revealWinner()
 */
contract EncryptedBlackjack is ZamaEthereumConfig {
    enum GameState {
        Waiting,       // No active game
        PlayerTurn,    // Player can hit or stand
        DealerTurn,    // Dealer revealing cards
        Finished       // Winner determined
    }

    struct Hand {
        euint8 card1;
        euint8 card2;
        euint8 card3;   // Optional third card
        euint8 card4;   // Optional fourth card
        euint16 sum;    // Encrypted hand sum
        uint8 cardCount;
        bool stood;
    }

    /// Current game state
    GameState public state;

    /// Player address
    address public player;

    /// Player's hand
    Hand private _playerHand;

    /// Dealer's hand
    Hand private _dealerHand;

    /// Bet amount
    uint256 public betAmount;

    /// Winner address
    address public winner;

    /// Game ID
    uint256 public gameId;

    /// Encrypted comparison result
    ebool private _playerWins;

    /// @notice Emitted when a new game starts
    /// @param player Address of player
    /// @param bet Bet amount
    event GameStarted(address indexed player, uint256 bet);

    /// @notice Emitted when player hits
    /// @param cardNumber Which card (3 or 4)
    event PlayerHit(uint8 cardNumber);

    /// @notice Emitted when player stands
    event PlayerStood();

    /// @notice Emitted when dealer plays
    event DealerPlayed();

    /// @notice Emitted when winner is determined
    /// @param winner Address of winner (address(0) = dealer)
    /// @param payout Amount paid out
    event GameResult(address indexed winner, uint256 payout);

    constructor() {
        gameId = 1;
        state = GameState.Waiting;
    }

    /// @notice Start a new game with initial two cards
    /// @param encCard1 First encrypted card (1-11)
    /// @param encCard2 Second encrypted card (1-11)
    /// @param encDealerCard1 Dealer's first card (hidden)
    /// @param encDealerCard2 Dealer's second card (hidden)
    /// @param inputProof Proof validating encrypted inputs
    function startGame(
        externalEuint8 encCard1,
        externalEuint8 encCard2,
        externalEuint8 encDealerCard1,
        externalEuint8 encDealerCard2,
        bytes calldata inputProof
    ) external payable {
        require(state == GameState.Waiting, "Game in progress");
        require(msg.value > 0, "Must place a bet");

        player = msg.sender;
        betAmount = msg.value;

        // 🔐 Convert player's encrypted cards
        euint8 card1 = FHE.fromExternal(encCard1, inputProof);
        euint8 card2 = FHE.fromExternal(encCard2, inputProof);

        FHE.allowThis(card1);
        FHE.allowThis(card2);
        FHE.allow(card1, msg.sender);
        FHE.allow(card2, msg.sender);

        // 🧮 Compute initial hand sum
        euint16 playerSum = FHE.add(FHE.asEuint16(card1), FHE.asEuint16(card2));
        FHE.allowThis(playerSum);
        FHE.allow(playerSum, msg.sender);

        _playerHand = Hand({
            card1: card1,
            card2: card2,
            card3: FHE.asEuint8(0),
            card4: FHE.asEuint8(0),
            sum: playerSum,
            cardCount: 2,
            stood: false
        });

        // 🔐 Convert dealer's encrypted cards (hidden from player)
        euint8 dealerCard1 = FHE.fromExternal(encDealerCard1, inputProof);
        euint8 dealerCard2 = FHE.fromExternal(encDealerCard2, inputProof);

        FHE.allowThis(dealerCard1);
        FHE.allowThis(dealerCard2);
        // ⚠️ Dealer cards NOT allowed to player - they stay hidden!

        euint16 dealerSum = FHE.add(
            FHE.asEuint16(dealerCard1),
            FHE.asEuint16(dealerCard2)
        );
        FHE.allowThis(dealerSum);

        _dealerHand = Hand({
            card1: dealerCard1,
            card2: dealerCard2,
            card3: FHE.asEuint8(0),
            card4: FHE.asEuint8(0),
            sum: dealerSum,
            cardCount: 2,
            stood: false
        });

        state = GameState.PlayerTurn;
        emit GameStarted(msg.sender, msg.value);
    }

    /// @notice Player takes another card
    /// @param encCard Encrypted new card (1-11)
    /// @param inputProof Proof validating encrypted input
    function hit(
        externalEuint8 encCard,
        bytes calldata inputProof
    ) external {
        require(state == GameState.PlayerTurn, "Not player turn");
        require(msg.sender == player, "Not your game");
        require(_playerHand.cardCount < 4, "Max 4 cards");

        euint8 newCard = FHE.fromExternal(encCard, inputProof);
        FHE.allowThis(newCard);
        FHE.allow(newCard, msg.sender);

        // 🧮 Add to hand sum using FHE
        _playerHand.sum = FHE.add(_playerHand.sum, FHE.asEuint16(newCard));
        FHE.allowThis(_playerHand.sum);
        FHE.allow(_playerHand.sum, msg.sender);

        _playerHand.cardCount++;

        // Store card in appropriate slot
        if (_playerHand.cardCount == 3) {
            _playerHand.card3 = newCard;
        } else {
            _playerHand.card4 = newCard;
        }

        emit PlayerHit(_playerHand.cardCount);
    }

    /// @notice Player stands (stops taking cards)
    function stand() external {
        require(state == GameState.PlayerTurn, "Not player turn");
        require(msg.sender == player, "Not your game");

        _playerHand.stood = true;
        state = GameState.DealerTurn;

        emit PlayerStood();
    }

    /// @notice Dealer plays their turn (can add third card)
    /// @param encDealerCard3 Optional third dealer card
    /// @param inputProof Proof if adding card
    /// @param addCard Whether dealer takes third card
    function dealerPlay(
        externalEuint8 encDealerCard3,
        bytes calldata inputProof,
        bool addCard
    ) external {
        require(state == GameState.DealerTurn, "Not dealer turn");

        if (addCard) {
            euint8 dealerCard3 = FHE.fromExternal(encDealerCard3, inputProof);
            FHE.allowThis(dealerCard3);

            _dealerHand.sum = FHE.add(
                _dealerHand.sum,
                FHE.asEuint16(dealerCard3)
            );
            FHE.allowThis(_dealerHand.sum);
            _dealerHand.card3 = dealerCard3;
            _dealerHand.cardCount++;
        }

        _dealerHand.stood = true;

        // 🎯 Compare hands using FHE
        _determineWinner();

        emit DealerPlayed();
    }

    /// @notice Compare hands and determine winner
    /// @dev Uses FHE.gt and FHE.select for encrypted comparison
    function _determineWinner() internal {
        // 🔍 Check for busts (sum > 21)
        ebool playerBust = FHE.gt(_playerHand.sum, FHE.asEuint16(21));
        ebool dealerBust = FHE.gt(_dealerHand.sum, FHE.asEuint16(21));

        // 📊 Compare sums
        ebool playerHigher = FHE.gt(_playerHand.sum, _dealerHand.sum);

        // 🎲 Winner logic:
        // - Player busts → dealer wins
        // - Dealer busts → player wins
        // - Neither bust → higher sum wins
        // Using nested FHE.select for complex conditionals

        // If player bust, player loses (false)
        // If dealer bust, player wins (true)
        // Otherwise, higher sum wins
        ebool dealerBustPlayerWins = FHE.and(dealerBust, FHE.not(playerBust));
        ebool noBusts = FHE.and(FHE.not(playerBust), FHE.not(dealerBust));
        ebool normalWin = FHE.and(noBusts, playerHigher);

        _playerWins = FHE.or(dealerBustPlayerWins, normalWin);

        FHE.allowThis(_playerWins);
        FHE.makePubliclyDecryptable(_playerWins);

        state = GameState.Finished;
    }

    /// @notice Reveal winner with decryption proof
    /// @param abiEncodedResult ABI-encoded bool result
    /// @param decryptionProof KMS signature proving decryption
    function revealWinner(
        bytes memory abiEncodedResult,
        bytes memory decryptionProof
    ) external {
        require(state == GameState.Finished, "Game not finished");

        // Verify decryption
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(_playerWins);
        FHE.checkSignatures(cts, abiEncodedResult, decryptionProof);

        bool playerWon = abi.decode(abiEncodedResult, (bool));

        uint256 payout;
        if (playerWon) {
            winner = player;
            payout = betAmount * 2;
            (bool sent, ) = player.call{value: payout}("");
            require(sent, "Payout failed");
        } else {
            winner = address(0); // Dealer wins
            payout = 0;
        }

        emit GameResult(winner, payout);
    }

    /// @notice Reset for a new game
    function resetGame() external {
        require(state == GameState.Finished, "Game not finished");

        delete _playerHand;
        delete _dealerHand;
        player = address(0);
        betAmount = 0;
        winner = address(0);
        state = GameState.Waiting;
        gameId++;
    }

    /// @notice Get game info
    function getGameInfo()
        external
        view
        returns (
            GameState currentState,
            address currentPlayer,
            uint256 currentBet,
            address currentWinner,
            uint256 currentGameId,
            uint8 playerCardCount,
            uint8 dealerCardCount
        )
    {
        return (
            state,
            player,
            betAmount,
            winner,
            gameId,
            _playerHand.cardCount,
            _dealerHand.cardCount
        );
    }

    /// @notice Get player's encrypted hand sum (only player can decrypt)
    function getPlayerSum() external view returns (euint16) {
        return _playerHand.sum;
    }

    /// @notice Check if address is the current player
    function isPlayer(address addr) external view returns (bool) {
        return addr == player;
    }

    /// @notice Allow contract to receive ETH (for dealer bets/payouts)
    receive() external payable {}
}

```

{% endtab %}

{% tab title="EncryptedBlackjack.ts" %}

```typescript
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedBlackjack, EncryptedBlackjack__factory } from "../types";
import { expect } from "chai";
import { describe } from "node:test";

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

```

{% endtab %}

{% endtabs %}
