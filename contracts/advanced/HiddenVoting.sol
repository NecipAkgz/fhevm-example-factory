// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Private voting system with homomorphic vote tallying (Yes/No).
 *         Ballots are added without decryption. Only final totals are revealed,
 *         ensuring individual vote secrecy forever.
 *
 * @dev Flow: vote() → closeVoting() → revealResults()
 *      ⚡ Gas: Each vote costs ~200k gas (FHE.add + FHE.select operations)
 */
contract HiddenVoting is ZamaEthereumConfig {
    enum VotingState {
        Active, // Accepting votes
        Closed, // Voting ended, pending reveal
        Revealed // Results revealed on-chain
    }

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

    /// Emitted when a vote is cast
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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call");
        _;
    }

    constructor(string memory _proposal, uint256 _durationSeconds) {
        require(bytes(_proposal).length > 0, "Empty proposal");
        require(_durationSeconds > 0, "Duration must be positive");

        owner = msg.sender;
        proposal = _proposal;
        endTime = block.timestamp + _durationSeconds;
        votingState = VotingState.Active;

        // Initialize encrypted counters
        _yesVotes = FHE.asEuint64(0);
        _noVotes = FHE.asEuint64(0);
        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);
    }

    /// @notice Cast an encrypted vote (0=No, 1=Yes)
    /// @dev Homomorphic tallying: votes added without decryption!
    /// @param inputProof Proof validating the encrypted input
    function vote(
        externalEuint8 encryptedVote,
        bytes calldata inputProof
    ) external {
        require(votingState == VotingState.Active, "Voting not active");
        require(block.timestamp < endTime, "Voting has ended");
        require(!hasVoted[msg.sender], "Already voted");

        // Convert vote and normalize to 0 or 1
        euint64 voteValue = FHE.asEuint64(
            FHE.fromExternal(encryptedVote, inputProof)
        );

        // 🧮 Why homomorphic? Votes are tallied WITHOUT decrypting individual ballots!
        // Individual votes remain private forever
        ebool isYes = FHE.gt(voteValue, FHE.asEuint64(0));

        // ➕ Add to Yes counter if vote is Yes (1)
        euint64 yesIncrement = FHE.select(
            isYes,
            FHE.asEuint64(1),
            FHE.asEuint64(0)
        );
        _yesVotes = FHE.add(_yesVotes, yesIncrement);

        euint64 noIncrement = FHE.select(
            isYes,
            FHE.asEuint64(0),
            FHE.asEuint64(1)
        );
        _noVotes = FHE.add(_noVotes, noIncrement);

        FHE.allowThis(_yesVotes);
        FHE.allowThis(_noVotes);

        hasVoted[msg.sender] = true;
        voterCount++;

        emit VoteCast(msg.sender);
    }

    /// @notice Close voting and mark results for decryption
    /// @dev Only owner can call after voting period ends
    function closeVoting() external onlyOwner {
        require(votingState == VotingState.Active, "Voting not active");
        require(block.timestamp >= endTime, "Voting not yet ended");

        // Mark totals for public decryption via relayer
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

        // Build handle array for signature verification
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_yesVotes);
        cts[1] = FHE.toBytes32(_noVotes);

        // Verify KMS proof (reverts if invalid)
        FHE.checkSignatures(cts, abiEncodedResults, decryptionProof);

        // Decode verified plaintext results
        (uint64 yesCount, uint64 noCount) = abi.decode(
            abiEncodedResults,
            (uint64, uint64)
        );

        revealedYesVotes = yesCount;
        revealedNoVotes = noCount;
        votingState = VotingState.Revealed;

        emit ResultsRevealed(yesCount, noCount);
    }

    function getEncryptedYesVotes() external view returns (euint64) {
        require(votingState != VotingState.Active, "Voting still active");
        return _yesVotes;
    }

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
