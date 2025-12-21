// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Simple Heads or Tails game demonstrating public, permissionless decryption with FHE.
 *
 * @dev Uses FHE.randEbool() for random result + FHE.makePubliclyDecryptable() for revealing.
 *      Anyone can decrypt results with valid KMS proof.
 */
contract HeadsOrTails is ZamaEthereumConfig {
    /// Simple counter to assign a unique ID to each new game.
    uint256 private counter = 0;

    /**
     * Defines the entire state for a single Heads or Tails game instance.
     */
    struct Game {
        address headsPlayer;
        address tailsPlayer;
        ebool encryptedHasHeadsWon;
        address winner;
    }

    // Mapping to store all game states, accessible by a unique game ID.
    mapping(uint256 gameId => Game game) public games;

    /// @notice Emitted when a new game is started, providing the encrypted handle required for decryption
    /// @param gameId The unique identifier for the game
    /// @param headsPlayer The address choosing Heads
    /// @param tailsPlayer The address choosing Tails
    /// @param encryptedHasHeadsWon The encrypted handle (ciphertext) storing the result
    event GameCreated(
        uint256 indexed gameId,
        address indexed headsPlayer,
        address indexed tailsPlayer,
        ebool encryptedHasHeadsWon
    );

    /// @notice Initiates a new Heads or Tails game, generates the result using FHE,
    /// @notice and makes the result publicly available for decryption.
    function headsOrTails(address headsPlayer, address tailsPlayer) external {
        require(headsPlayer != address(0), "Heads player is address zero");
        require(tailsPlayer != address(0), "Tails player is address zero");
        require(
            headsPlayer != tailsPlayer,
            "Heads player and Tails player should be different"
        );

        // true: Heads
        // false: Tails
        ebool headsOrTailsResult = FHE.randEbool();

        counter++;

        // gameId > 0
        uint256 gameId = counter;
        games[gameId] = Game({
            headsPlayer: headsPlayer,
            tailsPlayer: tailsPlayer,
            encryptedHasHeadsWon: headsOrTailsResult,
            winner: address(0)
        });

        // 🌐 Why makePubliclyDecryptable? Allows ANYONE to decrypt (not just allowed users)
        // Use case: Public game results, lottery winners, voting tallies
        FHE.makePubliclyDecryptable(headsOrTailsResult);

        // You can catch the event to get the gameId and the encryptedHasHeadsWon handle
        // for further decryption requests, or create a view function.
        emit GameCreated(
            gameId,
            headsPlayer,
            tailsPlayer,
            games[gameId].encryptedHasHeadsWon
        );
    }

    /// @notice Returns the number of games created so far.
    function getGamesCount() public view returns (uint256) {
        return counter;
    }

    /// @notice Returns the encrypted ebool handle that stores the game result.
    function hasHeadsWon(uint256 gameId) public view returns (ebool) {
        return games[gameId].encryptedHasHeadsWon;
    }

    /// @notice Returns the address of the game winner.
    function getWinner(uint256 gameId) public view returns (address) {
        require(
            games[gameId].winner != address(0),
            "Game winner not yet revealed"
        );
        return games[gameId].winner;
    }

    /// @notice Verifies the provided (decryption proof, ABI-encoded clear value) pair against the stored ciphertext,
    /// @notice and then stores the winner of the game.
    /// @dev gameId: The ID of the game to settle.
    ///      abiEncodedClearGameResult: The ABI-encoded clear value (bool) associated to the `decryptionProof`.
    ///      decryptionProof: The proof that validates the decryption.
    function recordAndVerifyWinner(
        uint256 gameId,
        bytes memory abiEncodedClearGameResult,
        bytes memory decryptionProof
    ) public {
        require(
            games[gameId].winner == address(0),
            "Game winner already revealed"
        );

        // Verify KMS decryption proof
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(games[gameId].encryptedHasHeadsWon);

        // This FHE call reverts the transaction if the decryption proof is invalid.
        FHE.checkSignatures(cts, abiEncodedClearGameResult, decryptionProof);

        // Decode the decrypted result to determine winner
        // Note: Using abi.decode here, but could also accept plain bool parameter
        bool decodedClearGameResult = abi.decode(
            abiEncodedClearGameResult,
            (bool)
        );
        address winner = decodedClearGameResult
            ? games[gameId].headsPlayer
            : games[gameId].tailsPlayer;

        // Store the winner
        games[gameId].winner = winner;
    }
}
