// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Implements a simple 8-sided Die Roll game demonstrating public, permissionless decryption
 * using the FHE.makePubliclyDecryptable feature.
 *
 * @dev Inherits from ZamaEthereumConfig to access FHE functions like FHE.randEbool() and FHE.verifySignatures().
 */
contract HighestDieRoll is ZamaEthereumConfig {
    constructor() {}

    // Simple counter to assign a unique ID to each new game.
    uint256 private counter = 0;

    /**
     * Defines the entire state for a single Heads or Tails game instance.
     */
    struct Game {
        // The address of the player who chose Heads.
        address playerA;
        // The address of the player who chose Tails.
        address playerB;
        // The core encrypted result. This is a publicly decryptable set of 4 handle.
        euint8 playerAEncryptedDieRoll;
        euint8 playerBEncryptedDieRoll;
        // The clear address of the final winne, address(0) if draw, set after decryption and verification.
        address winner;
        // true if the game result is revealed
        bool revealed;
    }

    // Mapping to store all game states, accessible by a unique game ID.
    mapping(uint256 gameId => Game game) public games;

    // Emitted when a new game is started, providing the encrypted handle required for decryption.
    // gameId: The unique identifier for the game.
    // playerA: The address of playerA.
    // playerB: The address of playerB.
    // playerAEncryptedDieRoll: The encrypted die roll result of playerA.
    // playerBEncryptedDieRoll: The encrypted die roll result of playerB.
    event GameCreated(
        uint256 indexed gameId,
        address indexed playerA,
        address indexed playerB,
        euint8 playerAEncryptedDieRoll,
        euint8 playerBEncryptedDieRoll
    );

    /// @notice Initiates a new highest die roll game, generates the result using FHE,
    /// @notice and makes the result publicly available for decryption.
    /// playerA: The player address choosing Heads.
    /// playerB: The player address choosing Tails.
    function highestDieRoll(address playerA, address playerB) external {
        require(playerA != address(0), "playerA is address zero");
        require(playerB != address(0), "playerB player is address zero");
        require(playerA != playerB, "playerA and playerB should be different");

        euint8 playerAEncryptedDieRoll = FHE.randEuint8();
        euint8 playerBEncryptedDieRoll = FHE.randEuint8();

        counter++;

        // gameId > 0
        uint256 gameId = counter;
        games[gameId] = Game({
            playerA: playerA,
            playerB: playerB,
            playerAEncryptedDieRoll: playerAEncryptedDieRoll,
            playerBEncryptedDieRoll: playerBEncryptedDieRoll,
            winner: address(0),
            revealed: false
        });

        // We make the results publicly decryptable.
        FHE.makePubliclyDecryptable(playerAEncryptedDieRoll);
        FHE.makePubliclyDecryptable(playerBEncryptedDieRoll);

        // You can catch the event to get the gameId and the die rolls handles
        // for further decryption requests, or create a view function.
        emit GameCreated(
            gameId,
            playerA,
            playerB,
            playerAEncryptedDieRoll,
            playerBEncryptedDieRoll
        );
    }

    /// @notice Returns the number of games created so far.
    function getGamesCount() public view returns (uint256) {
        return counter;
    }

    /// @notice Returns the encrypted euint8 handle that stores the playerA die roll.
    /// @dev gameId: The ID of the game.
    ///      returns: The encrypted result (euint8 handle).
    function getPlayerADieRoll(uint256 gameId) public view returns (euint8) {
        return games[gameId].playerAEncryptedDieRoll;
    }

    /// @notice Returns the encrypted euint8 handle that stores the playerB die roll.
    /// @dev gameId: The ID of the game.
    ///      returns: The encrypted result (euint8 handle).
    function getPlayerBDieRoll(uint256 gameId) public view returns (euint8) {
        return games[gameId].playerBEncryptedDieRoll;
    }

    /// @notice Returns the address of the game winner. If the game is finalized, the function returns `address(0)`
    /// @notice if the game is a draw.
    /// @dev gameId: The ID of the game.
    ///      returns: The winner's address (address(0) if not yet revealed or draw).
    function getWinner(uint256 gameId) public view returns (address) {
        require(games[gameId].revealed, "Game winner not yet revealed");
        return games[gameId].winner;
    }

    /// @notice Returns `true` if the game result is publicly revealed, `false` otherwise.
    /// @dev gameId: The ID of the game.
    ///      returns: true if the game is publicly revealed.
    function isGameRevealed(uint256 gameId) public view returns (bool) {
        return games[gameId].revealed;
    }

    /// @notice Verifies the provided (decryption proof, ABI-encoded clear values) pair against the stored ciphertext,
    /// @notice and then stores the winner of the game.
    /// @dev gameId: The ID of the game to settle.
    ///      abiEncodedClearGameResult: The ABI-encoded clear values (uint8, uint8) associated to the `decryptionProof`.
    ///      decryptionProof: The proof that validates the decryption.
    function recordAndVerifyWinner(
        uint256 gameId,
        bytes memory abiEncodedClearGameResult,
        bytes memory decryptionProof
    ) public {
        require(!games[gameId].revealed, "Game already revealed");

        // 1. FHE Verification: Build the list of ciphertexts (handles) and verify the proof.
        //    The verification checks that 'abiEncodedClearGameResult' is the true decryption
        //    of the '(playerAEncryptedDieRoll, playerBEncryptedDieRoll)' handle pair using
        //    the provided 'decryptionProof'.

        // Creating the list of handles in the right order! In this case the order does not matter since the proof
        // only involves 1 single handle.
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(games[gameId].playerAEncryptedDieRoll);
        cts[1] = FHE.toBytes32(games[gameId].playerBEncryptedDieRoll);

        // This FHE call reverts the transaction if the decryption proof is invalid.
        FHE.checkSignatures(cts, abiEncodedClearGameResult, decryptionProof);

        // 2. Decode the clear result and determine the winner's address.
        //    In this very specific case, the function argument `abiEncodedClearGameResult` could have been replaced by two
        //    `uint8` instead of an abi-encoded uint8 pair. In this case, we should have to compute abi.encode on-chain
        (
            uint8 decodedClearPlayerADieRoll,
            uint8 decodedClearPlayerBDieRoll
        ) = abi.decode(abiEncodedClearGameResult, (uint8, uint8));

        // The die is an 8-sided die (d8) (1..8)
        decodedClearPlayerADieRoll = (decodedClearPlayerADieRoll % 8) + 1;
        decodedClearPlayerBDieRoll = (decodedClearPlayerBDieRoll % 8) + 1;

        address winner = decodedClearPlayerADieRoll > decodedClearPlayerBDieRoll
            ? games[gameId].playerA
            : (
                decodedClearPlayerADieRoll < decodedClearPlayerBDieRoll
                    ? games[gameId].playerB
                    : address(0)
            );

        // 3. Store the revealed flag
        games[gameId].revealed = true;
        games[gameId].winner = winner;
    }
}
