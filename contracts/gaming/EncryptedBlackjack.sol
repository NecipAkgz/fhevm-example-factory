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
