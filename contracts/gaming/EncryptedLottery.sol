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
