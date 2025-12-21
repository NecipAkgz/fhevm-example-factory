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
 * @notice On-chain Texas Hold'em poker with encrypted hole cards.
 *         Two players receive encrypted hole cards that remain hidden throughout
 *         the game. Hand strength is computed using FHE operations. Winner is
 *         determined by comparing encrypted hand strengths. Demonstrates complex
 *         game logic with multiple encrypted states and conditional operations.
 *
 * @dev Flow: joinGame() → bet()/fold() → showdown() → revealWinner()
 *      Hand strength = card1 + card2 (simplified for demo)
 *      ⚠️ Production needs proper hand rankings (flush, straight, etc.)
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
