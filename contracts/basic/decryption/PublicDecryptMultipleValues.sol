// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Dice game demonstrating public decryption of multiple encrypted values.
 *         Shows how to use checkSignatures() with multiple values, highlighting
 *         that the order in cts[] must match the ABI-encoded results.
 *
 * @dev Uses FHE.randEuint8() and FHE.makePubliclyDecryptable().
 */
contract HighestDieRoll is ZamaEthereumConfig {
    // Simple counter to assign a unique ID to each new game.
    uint256 private counter = 0;

    /**
     * Defines the entire state for a single Die Roll game instance.
     */
    struct Game {
        address playerA;
        address playerB;
        euint8 playerAEncryptedDieRoll;
        euint8 playerBEncryptedDieRoll;
        address winner;
        bool revealed;
    }

    // Mapping to store all game states, accessible by a unique game ID.
    mapping(uint256 gameId => Game game) public games;

    /// @notice Emitted when a new game is started,
    ///         providing the encrypted handle required for decryption
    /// @param gameId The unique identifier for the game
    /// @param playerA The address of playerA
    /// @param playerB The address of playerB
    /// @param playerAEncryptedDieRoll The encrypted die roll result of playerA
    /// @param playerBEncryptedDieRoll The encrypted die roll result of playerB
    event GameCreated(
        uint256 indexed gameId,
        address indexed playerA,
        address indexed playerB,
        euint8 playerAEncryptedDieRoll,
        euint8 playerBEncryptedDieRoll
    );

    /// @notice Initiates a new highest die roll game, generates the result using FHE,
    /// @notice and makes the result publicly available for decryption.
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

        // 🌐 Both values marked for public decryption
        // Anyone can decrypt with valid KMS proof
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
    function getPlayerADieRoll(uint256 gameId) public view returns (euint8) {
        return games[gameId].playerAEncryptedDieRoll;
    }

    /// @notice Returns the encrypted euint8 handle that stores the playerB die roll.
    function getPlayerBDieRoll(uint256 gameId) public view returns (euint8) {
        return games[gameId].playerBEncryptedDieRoll;
    }

    /// @notice Returns the address of the game winner.
    ///         If the game is finalized, the function returns `address(0)`
    /// @notice if the game is a draw.
    function getWinner(uint256 gameId) public view returns (address) {
        require(games[gameId].revealed, "Game winner not yet revealed");
        return games[gameId].winner;
    }

    /// @notice Returns `true` if the game result is publicly revealed, `false` otherwise.
    function isGameRevealed(uint256 gameId) public view returns (bool) {
        return games[gameId].revealed;
    }

    /// @notice Verifies the provided (decryption proof, ABI-encoded clear values)
    ///         pair against the stored ciphertext, and then stores the winner of the game.
    function recordAndVerifyWinner(
        uint256 gameId,
        bytes memory abiEncodedClearGameResult,
        bytes memory decryptionProof
    ) public {
        require(!games[gameId].revealed, "Game already revealed");

        // Verify KMS proof - ORDER MATTERS!
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(games[gameId].playerAEncryptedDieRoll);
        cts[1] = FHE.toBytes32(games[gameId].playerBEncryptedDieRoll);

        // This FHE call reverts the transaction if the decryption proof is invalid.
        FHE.checkSignatures(cts, abiEncodedClearGameResult, decryptionProof);

        // Decode both decrypted die rolls
        // Note: Using abi.decode here, but could also accept two uint8 parameters
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

        // Store game result
        games[gameId].revealed = true;
        games[gameId].winner = winner;
    }
}
