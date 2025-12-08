// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Hidden Voting with encrypted ballots and homomorphic tallying
 *
 * @dev Demonstrates FHE voting patterns:
 *      - Encrypted vote submission (0 = No, 1 = Yes)
 *      - Homomorphic addition for vote tallying
 *      - FHE.makePubliclyDecryptable() for revealing final results
 *      - Privacy: individual votes remain encrypted forever
 *
 * Flow:
 * 1. Owner creates a proposal with voting duration
 * 2. Eligible voters submit encrypted votes (0 or 1)
 * 3. Votes are homomorphically added to running totals
 * 4. After voting ends, owner closes and results become decryptable
 * 5. Anyone can reveal final Yes/No counts with valid proof
 */
contract HiddenVoting is ZamaEthereumConfig {
    // ==================== TYPES ====================

    enum VotingState {
        Active, // Accepting votes
        Closed, // Voting ended, pending reveal
        Revealed // Results revealed on-chain
    }

    // ==================== STATE ====================

    /// Voting owner (deployer)
    address public owner;

    /// Current voting state
    VotingState public votingState;

    /// Proposal description
    string public proposal;

    /// Voting end timestamp
    uint256 public endTime;

    /// Whether an address has voted
    mapping(address => bool) public hasVoted;

    /// Total number of voters
    uint256 public voterCount;

    /// Encrypted total of Yes votes (1s)
    euint64 private _yesVotes;

    /// Encrypted total of No votes (0s counted separately for verification)
    euint64 private _noVotes;

    /// Revealed results
    uint64 public revealedYesVotes;
    uint64 public revealedNoVotes;

    // ==================== EVENTS ====================

    /// @notice Emitted when a vote is cast
    /// @param voter Address of the voter
    event VoteCast(address indexed voter);

    /// @notice Emitted when voting is closed
    /// @param encryptedYes Handle for encrypted Yes count
    /// @param encryptedNo Handle for encrypted No count
    event VotingClosed(euint64 encryptedYes, euint64 encryptedNo);

    /// @notice Emitted when results are revealed
    /// @param yesVotes Final Yes vote count
    /// @param noVotes Final No vote count
    event ResultsRevealed(uint64 yesVotes, uint64 noVotes);

    // ==================== MODIFIERS ====================

    /// @dev Restricts function to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /// @notice Creates a new voting proposal
    /// @param _proposal Description of what is being voted on
    /// @param _durationSeconds How long voting is open
    constructor(string memory _proposal, uint256 _durationSeconds) {
        require(bytes(_proposal).length > 0, "Empty proposal");
        require(_durationSeconds > 0, "Duration must be positive");

        owner = msg.sender;
        proposal = _proposal;
        endTime = block.timestamp + _durationSeconds;
        votingState = VotingState.Active;

        // 🔐 Initialize encrypted counters to zero
        _yesVotes = FHE.asEuint64(0);
        _noVotes = FHE.asEuint64(0);
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);
    }

    // ==================== VOTING ====================

    /// @notice Cast an encrypted vote
    /// @dev Vote must be 0 (No) or 1 (Yes). Values > 1 are treated as Yes.
    /// @param encryptedVote Encrypted vote (0 or 1)
    /// @param inputProof Proof validating the encrypted input
    function vote(
        externalEuint8 encryptedVote,
        bytes calldata inputProof
    ) external {
        require(votingState == VotingState.Active, "Voting not active");
        require(block.timestamp < endTime, "Voting has ended");
        require(!hasVoted[msg.sender], "Already voted");

        // 🔐 Convert external encrypted input
        // Note: Using euint8 for vote, but storing as euint64 for addition
        euint64 voteValue = FHE.asEuint64(
            FHE.fromExternal(encryptedVote, inputProof)
        );

        // 📊 Homomorphic vote counting
        // We use select to normalize: if vote > 0, count as 1 for Yes
        ebool isYes = FHE.gt(voteValue, FHE.asEuint64(0));

        // ➕ Add to Yes counter if vote is Yes (1)
        euint64 yesIncrement = FHE.select(
            isYes,
            FHE.asEuint64(1),
            FHE.asEuint64(0)
        );
        _yesVotes = FHE.add(_yesVotes, yesIncrement);

        // ➕ Add to No counter if vote is No (0)
        euint64 noIncrement = FHE.select(
            isYes,
            FHE.asEuint64(0),
            FHE.asEuint64(1)
        );
        _noVotes = FHE.add(_noVotes, noIncrement);

        // ✅ Update permissions for new values
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);

        // 📋 Record that this address has voted
        hasVoted[msg.sender] = true;
        voterCount++;

        emit VoteCast(msg.sender);
    }

    // ==================== CLOSE VOTING ====================

    /// @notice Close voting and prepare results for decryption
    /// @dev Only owner can call after voting period ends
    function closeVoting() external onlyOwner {
        require(votingState == VotingState.Active, "Voting not active");
        require(block.timestamp >= endTime, "Voting not yet ended");

        // 🔓 Make results publicly decryptable
        FHE.makePubliclyDecryptable(_yesVotes);
        FHE.makePubliclyDecryptable(_noVotes);

        votingState = VotingState.Closed;

        emit VotingClosed(_yesVotes, _noVotes);
    }

    /// @notice Reveal voting results with KMS decryption proof
    /// @dev Anyone can call with valid decryption proof
    /// @param abiEncodedResults ABI-encoded (uint64 yes, uint64 no)
    /// @param decryptionProof KMS signature proving decryption
    function revealResults(
        bytes memory abiEncodedResults,
        bytes memory decryptionProof
    ) external {
        require(votingState == VotingState.Closed, "Voting not closed");

        // 🔐 Build ciphertext list for verification
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_yesVotes);
        cts[1] = FHE.toBytes32(_noVotes);

        // 🔍 Verify the decryption proof (reverts if invalid)
        FHE.checkSignatures(cts, abiEncodedResults, decryptionProof);

        // 📤 Decode the verified results
        (uint64 yesCount, uint64 noCount) = abi.decode(
            abiEncodedResults,
            (uint64, uint64)
        );

        revealedYesVotes = yesCount;
        revealedNoVotes = noCount;
        votingState = VotingState.Revealed;

        emit ResultsRevealed(yesCount, noCount);
    }

    // ==================== VIEW FUNCTIONS ====================

    /// @notice Get encrypted Yes votes handle (after voting closed)
    function getEncryptedYesVotes() external view returns (euint64) {
        require(votingState != VotingState.Active, "Voting still active");
        return _yesVotes;
    }

    /// @notice Get encrypted No votes handle (after voting closed)
    function getEncryptedNoVotes() external view returns (euint64) {
        require(votingState != VotingState.Active, "Voting still active");
        return _noVotes;
    }

    /// @notice Check if proposal passed (more Yes than No)
    function hasPassed() external view returns (bool) {
        require(votingState == VotingState.Revealed, "Results not revealed");
        return revealedYesVotes > revealedNoVotes;
    }

    /// @notice Get time remaining for voting
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }
}
