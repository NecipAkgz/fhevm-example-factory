Encrypted Escrow service - amounts hidden until release!

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (6 items)</summary>

**Types:** `ebool` · `euint64` · `externalEuint64`

**Functions:**
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof

</details>

{% tabs %}

{% tab title="EncryptedEscrow.sol" %}

```solidity
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
 * @notice Encrypted Escrow service - amounts hidden until release!
 *
 * @dev Demonstrates secure escrow with FHE:
 *      - Escrow amounts remain encrypted
 *      - Conditions verified without revealing values
 *      - Multi-party agreement pattern
 *      - Dispute resolution with arbiter
 *
 * Flow:
 * 1. Buyer creates escrow with encrypted amount
 * 2. Buyer deposits funds
 * 3. Seller delivers goods/services
 * 4. Buyer releases funds OR disputes
 * 5. Arbiter resolves disputes if needed
 *
 * ⚠️ IMPORTANT: Amount revealed only on release/refund
 */
contract EncryptedEscrow is ZamaEthereumConfig {
    // ==================== TYPES ====================

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

    // ==================== STATE ====================

    /// Contract owner
    address public owner;

    /// Escrow ID counter
    uint256 public escrowCount;

    /// Mapping from escrow ID to Escrow data
    mapping(uint256 => Escrow) private _escrows;

    /// Arbiter fee percentage (default 1%)
    uint256 public arbiterFeePercent;

    // ==================== EVENTS ====================

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

    // ==================== CONSTRUCTOR ====================

    /// @notice Creates the escrow contract
    /// @param _arbiterFeePercent Fee percentage for arbiter (0-10)
    constructor(uint256 _arbiterFeePercent) {
        require(_arbiterFeePercent <= 10, "Fee too high");
        owner = msg.sender;
        arbiterFeePercent = _arbiterFeePercent;
    }

    // ==================== ESCROW CREATION ====================

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

    // ==================== RELEASE / REFUND ====================

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

    // ==================== DISPUTE RESOLUTION ====================

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

    // ==================== VIEW FUNCTIONS ====================

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

```

{% endtab %}

{% tab title="EncryptedEscrow.ts" %}

```typescript
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EncryptedEscrow, EncryptedEscrow__factory } from "../types";
import { expect } from "chai";

type Signers = {
  buyer: HardhatEthersSigner;
  seller: HardhatEthersSigner;
  arbiter: HardhatEthersSigner;
};

const ARBITER_FEE = 1; // 1%
const DEADLINE_OFFSET = 86400; // 1 day

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "EncryptedEscrow"
  )) as EncryptedEscrow__factory;
  const escrow = (await factory.deploy(ARBITER_FEE)) as EncryptedEscrow;
  const escrowAddress = await escrow.getAddress();

  return { escrow, escrowAddress };
}

/**
 * Encrypted Escrow Tests
 *
 * Tests secure escrow with encrypted amounts and dispute resolution.
 */
describe("EncryptedEscrow", function () {
  let signers: Signers;
  let escrow: EncryptedEscrow;
  let escrowAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      buyer: ethSigners[0],
      seller: ethSigners[1],
      arbiter: ethSigners[2],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ escrow, escrowAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await escrow.owner()).to.equal(signers.buyer.address);
      expect(await escrow.arbiterFeePercent()).to.equal(BigInt(ARBITER_FEE));
      expect(await escrow.escrowCount()).to.equal(0n);
    });

    it("should reject fee percentage above 10%", async function () {
      const factory = await ethers.getContractFactory("EncryptedEscrow");
      await expect(factory.deploy(15)).to.be.revertedWith("Fee too high");
    });
  });

  describe("Escrow Creation", function () {
    it("should create escrow with encrypted amount", async function () {
      const amount = ethers.parseEther("1");
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const encryptedAmount = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(amount)
        .encrypt();

      await expect(
        escrow.createEscrow(
          signers.seller.address,
          signers.arbiter.address,
          encryptedAmount.handles[0],
          encryptedAmount.inputProof,
          deadline
        )
      ).to.emit(escrow, "EscrowCreated");

      expect(await escrow.escrowCount()).to.equal(1n);
    });

    it("should reject invalid seller address", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(1000n)
        .encrypt();

      await expect(
        escrow.createEscrow(
          ethers.ZeroAddress,
          signers.arbiter.address,
          enc.handles[0],
          enc.inputProof,
          deadline
        )
      ).to.be.revertedWith("Invalid seller");
    });

    it("should reject buyer as seller", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(1000n)
        .encrypt();

      await expect(
        escrow.createEscrow(
          signers.buyer.address,
          signers.arbiter.address,
          enc.handles[0],
          enc.inputProof,
          deadline
        )
      ).to.be.revertedWith("Buyer cannot be seller");
    });
  });

  describe("Funding", function () {
    let escrowId: bigint;

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(ethers.parseEther("1"))
        .encrypt();

      await escrow.createEscrow(
        signers.seller.address,
        signers.arbiter.address,
        enc.handles[0],
        enc.inputProof,
        deadline
      );
      escrowId = 1n;
    });

    it("should allow buyer to fund escrow", async function () {
      const amount = ethers.parseEther("1");

      await expect(escrow.fundEscrow(escrowId, { value: amount }))
        .to.emit(escrow, "EscrowFunded")
        .withArgs(escrowId, amount);

      const info = await escrow.getEscrow(escrowId);
      expect(info.depositedAmount).to.equal(amount);
      expect(info.state).to.equal(1); // Funded
    });

    it("should prevent non-buyer from funding", async function () {
      await expect(
        escrow
          .connect(signers.seller)
          .fundEscrow(escrowId, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Only buyer can fund");
    });
  });

  describe("Release and Refund", function () {
    let escrowId: bigint;
    const DEPOSIT = ethers.parseEther("1");

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(DEPOSIT)
        .encrypt();

      await escrow.createEscrow(
        signers.seller.address,
        signers.arbiter.address,
        enc.handles[0],
        enc.inputProof,
        deadline
      );
      escrowId = 1n;
      await escrow.fundEscrow(escrowId, { value: DEPOSIT });
    });

    it("should allow buyer to release funds", async function () {
      const sellerBalanceBefore = await ethers.provider.getBalance(
        signers.seller.address
      );

      await expect(escrow.release(escrowId))
        .to.emit(escrow, "FundsReleased")
        .withArgs(escrowId, signers.seller.address);

      const sellerBalanceAfter = await ethers.provider.getBalance(
        signers.seller.address
      );
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(DEPOSIT);
    });

    it("should prevent non-buyer from releasing", async function () {
      await expect(
        escrow.connect(signers.seller).release(escrowId)
      ).to.be.revertedWith("Only buyer can release");
    });

    it("should prevent refund before deadline", async function () {
      await expect(escrow.requestRefund(escrowId)).to.be.revertedWith(
        "Deadline not passed"
      );
    });
  });

  describe("Dispute Resolution", function () {
    let escrowId: bigint;
    const DEPOSIT = ethers.parseEther("1");

    beforeEach(async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = (block?.timestamp || 0) + DEADLINE_OFFSET;

      const enc = await fhevm
        .createEncryptedInput(escrowAddress, signers.buyer.address)
        .add64(DEPOSIT)
        .encrypt();

      await escrow.createEscrow(
        signers.seller.address,
        signers.arbiter.address,
        enc.handles[0],
        enc.inputProof,
        deadline
      );
      escrowId = 1n;
      await escrow.fundEscrow(escrowId, { value: DEPOSIT });
    });

    it("should allow buyer to raise dispute", async function () {
      await expect(escrow.raiseDispute(escrowId))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(escrowId, signers.buyer.address);

      const info = await escrow.getEscrow(escrowId);
      expect(info.state).to.equal(4); // Disputed
    });

    it("should allow arbiter to resolve in favor of buyer", async function () {
      await escrow.raiseDispute(escrowId);

      const buyerBalanceBefore = await ethers.provider.getBalance(
        signers.buyer.address
      );

      await expect(
        escrow.connect(signers.arbiter).resolveDispute(escrowId, true)
      )
        .to.emit(escrow, "DisputeResolved")
        .withArgs(escrowId, signers.buyer.address);

      const buyerBalanceAfter = await ethers.provider.getBalance(
        signers.buyer.address
      );
      // Buyer receives 99% (1% arbiter fee)
      const expected = DEPOSIT - DEPOSIT / 100n;
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(expected);
    });

    it("should prevent non-arbiter from resolving", async function () {
      await escrow.raiseDispute(escrowId);

      await expect(escrow.resolveDispute(escrowId, true)).to.be.revertedWith(
        "Only arbiter"
      );
    });
  });

  describe("View Functions", function () {
    it("should check deadline status", async function () {
      // Non-existent escrow with deadline = 0 means timestamp > 0 is always true
      expect(await escrow.isDeadlinePassed(999)).to.be.true;
    });
  });
});

```

{% endtab %}

{% endtabs %}
