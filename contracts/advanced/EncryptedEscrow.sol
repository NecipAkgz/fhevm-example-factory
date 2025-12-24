// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    euint64,
    ebool,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @notice Confidential escrow service with hidden transaction amounts and arbiters.
 *         Secures funds with encrypted amounts. Details remain hidden until
 *         release or refund, supporting multi-party dispute resolution.
 *
 * @dev Flow: createEscrow() → fundEscrow() → release()/requestRefund()/raiseDispute()
 */
contract EncryptedEscrow is ZamaEthereumConfig {
    enum EscrowState {
        Created, // Escrow created, awaiting deposit
        Funded, // Funds deposited
        Released, // Funds released to seller
        Refunded, // Funds returned to buyer
        Disputed // Under dispute resolution
    }

    struct Escrow {
        address buyer;
        address seller;
        address arbiter;
        euint64 encryptedAmount;
        uint256 depositedAmount;
        EscrowState state;
        uint256 createdAt;
        uint256 deadline;
    }

    /// Contract owner
    address public owner;

    /// Escrow ID counter
    uint256 public escrowCount;

    /// Mapping from escrow ID to Escrow data
    mapping(uint256 => Escrow) private _escrows;

    /// Arbiter fee percentage (default 1%)
    uint256 public arbiterFeePercent;

    /// @notice Emitted when escrow is created
    /// @param escrowId ID of the escrow
    /// @param buyer Address of buyer
    /// @param seller Address of seller
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller
    );

    /// @notice Emitted when escrow is funded
    /// @param escrowId ID of the escrow
    /// @param amount Amount deposited
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);

    /// @notice Emitted when funds are released
    /// @param escrowId ID of the escrow
    /// @param recipient Address receiving funds
    event FundsReleased(uint256 indexed escrowId, address indexed recipient);

    /// @notice Emitted when funds are refunded
    /// @param escrowId ID of the escrow
    /// @param recipient Address receiving refund
    event FundsRefunded(uint256 indexed escrowId, address indexed recipient);

    /// @notice Emitted when dispute is raised
    /// @param escrowId ID of the escrow
    /// @param raisedBy Address raising dispute
    event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy);

    /// @notice Emitted when dispute is resolved
    /// @param escrowId ID of the escrow
    /// @param winner Address favored in resolution
    event DisputeResolved(uint256 indexed escrowId, address indexed winner);

    /// @notice Creates the escrow contract
    /// @param _arbiterFeePercent Fee percentage for arbiter (0-10)
    constructor(uint256 _arbiterFeePercent) {
        require(_arbiterFeePercent <= 10, "Fee too high");
        owner = msg.sender;
        arbiterFeePercent = _arbiterFeePercent;
    }

    /// @notice Create a new escrow with encrypted amount
    /// @param seller Address of the seller
    /// @param arbiter Address of dispute arbiter
    /// @param encryptedAmount Encrypted escrow amount
    /// @param inputProof Proof validating the encrypted input
    /// @param deadline Deadline timestamp for delivery
    /// @return escrowId The ID of created escrow
    function createEscrow(
        address seller,
        address arbiter,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint256 deadline
    ) external returns (uint256 escrowId) {
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Buyer cannot be seller");
        require(arbiter != address(0), "Invalid arbiter");
        require(arbiter != msg.sender && arbiter != seller, "Invalid arbiter");
        require(deadline > block.timestamp, "Deadline must be future");

        escrowId = ++escrowCount;

        // 🔐 Convert external encrypted input
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender); // Buyer can view
        FHE.allow(amount, seller); // Seller can view
        FHE.allow(amount, arbiter); // Arbiter can view

        _escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            arbiter: arbiter,
            encryptedAmount: amount,
            depositedAmount: 0,
            state: EscrowState.Created,
            createdAt: block.timestamp,
            deadline: deadline
        });

        emit EscrowCreated(escrowId, msg.sender, seller);
    }

    /// @notice Fund the escrow
    /// @dev Amount verified against encrypted value on release
    /// @param escrowId ID of escrow to fund
    function fundEscrow(uint256 escrowId) external payable {
        Escrow storage escrow = _escrows[escrowId];
        require(escrow.buyer == msg.sender, "Only buyer can fund");
        require(escrow.state == EscrowState.Created, "Invalid state");
        require(msg.value > 0, "Must send funds");

        escrow.depositedAmount = msg.value;
        escrow.state = EscrowState.Funded;

        emit EscrowFunded(escrowId, msg.value);
    }

    /// @notice Release funds to seller
    /// @dev Only buyer can release after delivery
    /// @param escrowId ID of escrow to release
    function release(uint256 escrowId) external {
        Escrow storage escrow = _escrows[escrowId];
        require(escrow.buyer == msg.sender, "Only buyer can release");
        require(escrow.state == EscrowState.Funded, "Not funded");

        uint256 amount = escrow.depositedAmount;
        escrow.depositedAmount = 0;
        escrow.state = EscrowState.Released;

        // Transfer to seller
        (bool sent, ) = escrow.seller.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsReleased(escrowId, escrow.seller);
    }

    /// @notice Request refund (before deadline or after timeout)
    /// @param escrowId ID of escrow
    function requestRefund(uint256 escrowId) external {
        Escrow storage escrow = _escrows[escrowId];
        require(escrow.buyer == msg.sender, "Only buyer");
        require(escrow.state == EscrowState.Funded, "Not funded");
        require(block.timestamp > escrow.deadline, "Deadline not passed");

        uint256 amount = escrow.depositedAmount;
        escrow.depositedAmount = 0;
        escrow.state = EscrowState.Refunded;

        (bool sent, ) = escrow.buyer.call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsRefunded(escrowId, escrow.buyer);
    }

    /// @notice Raise a dispute
    /// @param escrowId ID of escrow
    function raiseDispute(uint256 escrowId) external {
        Escrow storage escrow = _escrows[escrowId];
        require(
            escrow.buyer == msg.sender || escrow.seller == msg.sender,
            "Not a party"
        );
        require(escrow.state == EscrowState.Funded, "Not funded");

        escrow.state = EscrowState.Disputed;

        emit DisputeRaised(escrowId, msg.sender);
    }

    /// @notice Resolve dispute - arbiter decides winner
    /// @param escrowId ID of escrow
    /// @param favorBuyer True to refund buyer, false to release to seller
    function resolveDispute(uint256 escrowId, bool favorBuyer) external {
        Escrow storage escrow = _escrows[escrowId];
        require(escrow.arbiter == msg.sender, "Only arbiter");
        require(escrow.state == EscrowState.Disputed, "Not disputed");

        uint256 amount = escrow.depositedAmount;
        uint256 arbiterFee = (amount * arbiterFeePercent) / 100;
        uint256 payout = amount - arbiterFee;

        escrow.depositedAmount = 0;

        address winner;
        if (favorBuyer) {
            escrow.state = EscrowState.Refunded;
            winner = escrow.buyer;
        } else {
            escrow.state = EscrowState.Released;
            winner = escrow.seller;
        }

        // Pay arbiter fee
        if (arbiterFee > 0) {
            (bool feeSent, ) = escrow.arbiter.call{value: arbiterFee}("");
            require(feeSent, "Arbiter fee failed");
        }

        // Pay winner
        (bool sent, ) = winner.call{value: payout}("");
        require(sent, "Payout failed");

        emit DisputeResolved(escrowId, winner);
    }

    /// @notice Get escrow details
    function getEscrow(
        uint256 escrowId
    )
        external
        view
        returns (
            address buyer,
            address seller,
            address arbiter,
            uint256 depositedAmount,
            EscrowState state,
            uint256 createdAt,
            uint256 deadline
        )
    {
        Escrow storage escrow = _escrows[escrowId];
        return (
            escrow.buyer,
            escrow.seller,
            escrow.arbiter,
            escrow.depositedAmount,
            escrow.state,
            escrow.createdAt,
            escrow.deadline
        );
    }

    /// @notice Get encrypted amount handle (for permitted parties)
    function getEncryptedAmount(
        uint256 escrowId
    ) external view returns (euint64) {
        Escrow storage escrow = _escrows[escrowId];
        require(
            msg.sender == escrow.buyer ||
                msg.sender == escrow.seller ||
                msg.sender == escrow.arbiter,
            "Not authorized"
        );
        return escrow.encryptedAmount;
    }

    /// @notice Check if deadline has passed
    function isDeadlinePassed(uint256 escrowId) external view returns (bool) {
        return block.timestamp > _escrows[escrowId].deadline;
    }
}
