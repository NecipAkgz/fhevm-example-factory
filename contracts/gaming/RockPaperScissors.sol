// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint8, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Fair Rock-Paper-Scissors game with encrypted moves.
 *         Players submit encrypted moves (0=Rock, 1=Paper, 2=Scissors) ensuring
 *         neither player can see the other's choice before committing. Winner is
 *         determined using FHE operations and revealed publicly. No trusted third
 *         party needed - cryptography guarantees fairness.

 * @dev Commit-reveal pattern without trusted third party.
 *      Move encoding: 0=Rock, 1=Paper, 2=Scissors
 *      ⚡ Gas: FHE.rem() is computationally expensive (~300k gas)
 */
contract RockPaperScissors is ZamaEthereumConfig {
    enum GameState {
        WaitingForPlayers, // 0 or 1 player joined
        BothMoved, // Both players submitted moves
        Revealed // Winner determined and revealed
    }

    address public player1;

    /// Player 2 address
    address public player2;

    /// Game state
    GameState public state;

    /// Encrypted moves
    euint8 private _move1;
    euint8 private _move2;

    /// Winner address (set after reveal)
    address public winner;

    /// Game ID for tracking multiple games
    uint256 public gameId;

    /// Emitted when a player joins
    /// @param player Address of joining player
    /// @param playerNumber 1 or 2
    event PlayerJoined(address indexed player, uint8 playerNumber);

    /// @notice Emitted when both moves are submitted
    event BothMovesMade();

    /// @notice Emitted when winner is revealed
    /// @param winner Address of winner (address(0) for tie)
    /// @param gameId Current game ID
    event GameResult(address indexed winner, uint256 indexed gameId);

    constructor() {
        gameId = 1;
        state = GameState.WaitingForPlayers;
    }

    /// @notice Submit an encrypted move to play
    /// @dev Move must be 0 (Rock), 1 (Paper), or 2 (Scissors)
    /// @param inputProof Proof validating the encrypted input
    function play(
        externalEuint8 encryptedMove,
        bytes calldata inputProof
    ) external {
        require(
            state == GameState.WaitingForPlayers,
            "Game not accepting moves"
        );
        require(
            msg.sender != player1 && msg.sender != player2,
            "Already in this game"
        );

        // Convert and validate encrypted move
        euint8 move = FHE.fromExternal(encryptedMove, inputProof);
        FHE.allowThis(move);

        if (player1 == address(0)) {
            // First player joins
            player1 = msg.sender;
            _move1 = move;
            emit PlayerJoined(msg.sender, 1);
        } else {
            // Second player joins
            player2 = msg.sender;
            _move2 = move;
            state = GameState.BothMoved;
            emit PlayerJoined(msg.sender, 2);
            emit BothMovesMade();
        }
    }

    /// @notice Determine the winner using FHE computation
    /// @dev Anyone can call after both players have moved
    function determineWinner() external {
        require(state == GameState.BothMoved, "Not ready to determine winner");

        // Winner calculation: (move1 - move2 + 3) % 3
        // 0=tie, 1=player1 wins, 2=player2 wins
        euint8 diff = FHE.add(
            FHE.add(_move1, FHE.asEuint8(3)),
            FHE.neg(_move2)
        );

        // 🎲 Why rem? Modulo keeps result in 0-2 range (tie/p1 wins/p2 wins)
        // ⚡ rem is expensive (~300k gas) - consider alternatives for production
        euint8 result = FHE.rem(diff, 3);

        // Compare results to determine outcome
        ebool isTie = FHE.eq(result, FHE.asEuint8(0));
        ebool player1Wins = FHE.eq(result, FHE.asEuint8(1));

        // 🌐 Why makePubliclyDecryptable? Anyone can decrypt result with KMS proof
        FHE.allowThis(result);
        FHE.makePubliclyDecryptable(result);

        state = GameState.Revealed;

        emit GameResult(address(0), gameId); // Placeholder - real winner after decryption
    }

    /// @notice Reveal winner with decryption proof
    /// @param abiEncodedResult ABI-encoded uint8 result
    /// @param decryptionProof KMS signature proving decryption
    function revealWinner(
        bytes memory abiEncodedResult,
        bytes memory decryptionProof
    ) external {
        require(state == GameState.Revealed, "Game not ready for reveal");

        // Build ciphertext list for verification
        euint8 diff = FHE.add(
            FHE.add(_move1, FHE.asEuint8(3)),
            FHE.neg(_move2)
        );
        euint8 result = FHE.rem(diff, 3);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(result);

        // Verify the decryption proof
        FHE.checkSignatures(cts, abiEncodedResult, decryptionProof);

        // Decode result
        uint8 resultValue = abi.decode(abiEncodedResult, (uint8));

        if (resultValue == 0) {
            winner = address(0); // Tie
        } else if (resultValue == 1) {
            winner = player1;
        } else {
            winner = player2;
        }

        emit GameResult(winner, gameId);
    }

    /// @notice Reset for a new game
    /// @dev Only callable after game is revealed
    function resetGame() external {
        require(state == GameState.Revealed, "Current game not finished");

        // Reset state
        player1 = address(0);
        player2 = address(0);
        winner = address(0);
        state = GameState.WaitingForPlayers;
        gameId++;
    }

    function getGameState()
        external
        view
        returns (
            address p1,
            address p2,
            GameState currentState,
            address currentWinner,
            uint256 currentGameId
        )
    {
        return (player1, player2, state, winner, gameId);
    }

    /// @notice Check if an address is in the current game
    function isPlayer(address addr) external view returns (bool) {
        return addr == player1 || addr == player2;
    }
}
