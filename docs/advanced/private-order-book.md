Private order book where order amounts and prices remain encrypted. Demonstrates MEV-resistant trading by hiding order details until matching. Uses FHE.ge for price matching and FHE.min for partial fills.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

<details>
<summary>🔐 FHE API Reference (13 items)</summary>

**Types:** `ebool` · `euint64` · `externalEuint64`

**Functions:**
- `FHE.allow()` - Grants PERMANENT permission for address to decrypt/use value
- `FHE.allowThis()` - Grants contract permission to operate on ciphertext
- `FHE.asEuint64()` - Encrypts a plaintext uint64 value into euint64
- `FHE.checkSignatures()` - Verifies KMS decryption proof (reverts if invalid)
- `FHE.fromExternal()` - Validates and converts external encrypted input using inputProof
- `FHE.ge()` - Encrypted greater-or-equal: returns ebool(a >= b)
- `FHE.makePubliclyDecryptable()` - Marks ciphertext for public decryption via relayer
- `FHE.min()` - Returns smaller of two encrypted values
- `FHE.select()` - Encrypted if-then-else: select(cond, a, b) → returns a if true, b if false
- `FHE.toBytes32()` - Converts encrypted handle to bytes32 for proof arrays

</details>

{% tabs %}

{% tab title="PrivateOrderBook.sol" %}

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
 * @notice Private order book where order amounts and prices remain encrypted.
 *         Demonstrates MEV-resistant trading by hiding order details until matching.
 *         Uses FHE.ge for price matching and FHE.min for partial fills.
 *
 * @dev Flow: placeBuyOrder()/placeSellOrder() → matchOrders() → revealTrade()
 */
contract PrivateOrderBook is ZamaEthereumConfig {
    enum OrderType {
        Buy,
        Sell
    }

    enum OrderStatus {
        Active,     // Order is live
        Matched,    // Order has been matched
        Cancelled   // Order was cancelled
    }

    struct Order {
        address trader;
        OrderType orderType;
        euint64 price;      // Encrypted price
        euint64 amount;     // Encrypted amount
        OrderStatus status;
        uint256 timestamp;
    }

    /// All orders
    Order[] private _orders;

    /// Mapping from trader to their order IDs
    mapping(address => uint256[]) private _traderOrders;

    /// Trade counter
    uint256 public tradeCount;

    /// Order counter
    uint256 public orderCount;

    /// Encrypted matched trade details
    euint64 private _matchedPrice;
    euint64 private _matchedAmount;
    uint256 private _matchedBuyOrderId;
    uint256 private _matchedSellOrderId;

    /// @notice Emitted when an order is placed
    /// @param orderId ID of the new order
    /// @param trader Address of trader
    /// @param orderType Buy (0) or Sell (1)
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        OrderType orderType
    );

    /// @notice Emitted when orders are matched
    /// @param buyOrderId Buy order ID
    /// @param sellOrderId Sell order ID
    event OrdersMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId
    );

    /// @notice Emitted when trade is revealed
    /// @param buyer Buyer address
    /// @param seller Seller address
    /// @param price Trade price
    /// @param amount Trade amount
    event TradeExecuted(
        address indexed buyer,
        address indexed seller,
        uint64 price,
        uint64 amount
    );

    /// @notice Emitted when order is cancelled
    /// @param orderId Cancelled order ID
    event OrderCancelled(uint256 indexed orderId);

    constructor() {
        orderCount = 0;
        tradeCount = 0;
    }

    /// @notice Place a buy order with encrypted price and amount
    /// @param encryptedPrice Encrypted price you're willing to pay
    /// @param encryptedAmount Encrypted amount you want to buy
    /// @param inputProof Proof validating encrypted inputs
    function placeBuyOrder(
        externalEuint64 encryptedPrice,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (uint256 orderId) {
        return _placeOrder(encryptedPrice, encryptedAmount, inputProof, OrderType.Buy);
    }

    /// @notice Place a sell order with encrypted price and amount
    /// @param encryptedPrice Encrypted price you want to receive
    /// @param encryptedAmount Encrypted amount you want to sell
    /// @param inputProof Proof validating encrypted inputs
    function placeSellOrder(
        externalEuint64 encryptedPrice,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (uint256 orderId) {
        return _placeOrder(encryptedPrice, encryptedAmount, inputProof, OrderType.Sell);
    }

    /// @dev Internal function to place any order type
    function _placeOrder(
        externalEuint64 encryptedPrice,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        OrderType orderType
    ) internal returns (uint256 orderId) {
        // 🔐 Convert encrypted inputs
        euint64 price = FHE.fromExternal(encryptedPrice, inputProof);
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // ✅ Grant permissions
        FHE.allowThis(price);
        FHE.allowThis(amount);
        FHE.allow(price, msg.sender);
        FHE.allow(amount, msg.sender);

        // 📋 Create order
        orderId = orderCount++;
        _orders.push(Order({
            trader: msg.sender,
            orderType: orderType,
            price: price,
            amount: amount,
            status: OrderStatus.Active,
            timestamp: block.timestamp
        }));

        _traderOrders[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, orderType);
    }

    /// @notice Try to match a buy order with a sell order
    /// @dev Uses FHE.ge to check if buy price >= sell price (match condition)
    /// @param buyOrderId ID of the buy order
    /// @param sellOrderId ID of the sell order
    function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external {
        require(buyOrderId < orderCount, "Invalid buy order");
        require(sellOrderId < orderCount, "Invalid sell order");

        Order storage buyOrder = _orders[buyOrderId];
        Order storage sellOrder = _orders[sellOrderId];

        require(buyOrder.status == OrderStatus.Active, "Buy order not active");
        require(sellOrder.status == OrderStatus.Active, "Sell order not active");
        require(buyOrder.orderType == OrderType.Buy, "Not a buy order");
        require(sellOrder.orderType == OrderType.Sell, "Not a sell order");
        require(buyOrder.trader != sellOrder.trader, "Self-matching not allowed");

        // 🔍 Check if orders can match: buyPrice >= sellPrice
        ebool canMatch = FHE.ge(buyOrder.price, sellOrder.price);

        // 🧮 Calculate trade amount: min(buyAmount, sellAmount)
        euint64 tradeAmount = FHE.min(buyOrder.amount, sellOrder.amount);

        // 💰 Use sell price as execution price (price improvement for buyer)
        euint64 executionPrice = sellOrder.price;

        // 🔀 Use select to only record match if prices align
        // If can't match, amount becomes 0
        _matchedAmount = FHE.select(canMatch, tradeAmount, FHE.asEuint64(0));
        _matchedPrice = FHE.select(canMatch, executionPrice, FHE.asEuint64(0));

        FHE.allowThis(_matchedAmount);
        FHE.allowThis(_matchedPrice);
        FHE.makePubliclyDecryptable(_matchedAmount);
        FHE.makePubliclyDecryptable(_matchedPrice);

        _matchedBuyOrderId = buyOrderId;
        _matchedSellOrderId = sellOrderId;

        // Mark orders as matched (will be finalized on reveal)
        buyOrder.status = OrderStatus.Matched;
        sellOrder.status = OrderStatus.Matched;

        emit OrdersMatched(buyOrderId, sellOrderId);
    }

    /// @notice Reveal the matched trade with decryption proof
    /// @param abiEncodedResults ABI-encoded trade details
    /// @param decryptionProof KMS signature proving decryption
    function revealTrade(
        bytes memory abiEncodedResults,
        bytes memory decryptionProof
    ) external {
        require(_matchedBuyOrderId < orderCount, "No pending match");

        // Build handle array
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_matchedPrice);
        cts[1] = FHE.toBytes32(_matchedAmount);

        // Verify KMS signatures
        FHE.checkSignatures(cts, abiEncodedResults, decryptionProof);

        // Decode results
        (uint64 price, uint64 amount) = abi.decode(
            abiEncodedResults,
            (uint64, uint64)
        );

        Order storage buyOrder = _orders[_matchedBuyOrderId];
        Order storage sellOrder = _orders[_matchedSellOrderId];

        if (amount > 0) {
            // Valid match occurred
            tradeCount++;
            emit TradeExecuted(
                buyOrder.trader,
                sellOrder.trader,
                price,
                amount
            );
        } else {
            // Match failed (prices didn't align) - reactivate orders
            buyOrder.status = OrderStatus.Active;
            sellOrder.status = OrderStatus.Active;
        }
    }

    /// @notice Cancel an active order
    /// @param orderId ID of order to cancel
    function cancelOrder(uint256 orderId) external {
        require(orderId < orderCount, "Invalid order");
        Order storage order = _orders[orderId];
        require(order.trader == msg.sender, "Not your order");
        require(order.status == OrderStatus.Active, "Order not active");

        order.status = OrderStatus.Cancelled;
        emit OrderCancelled(orderId);
    }

    /// @notice Get order count
    function getOrderCount() external view returns (uint256) {
        return orderCount;
    }

    /// @notice Get orders for a trader
    function getTraderOrders(address trader) external view returns (uint256[] memory) {
        return _traderOrders[trader];
    }

    /// @notice Get order details (public fields only)
    function getOrderInfo(uint256 orderId) external view returns (
        address trader,
        OrderType orderType,
        OrderStatus status,
        uint256 timestamp
    ) {
        require(orderId < orderCount, "Invalid order");
        Order storage order = _orders[orderId];
        return (order.trader, order.orderType, order.status, order.timestamp);
    }

    /// @notice Get encrypted price of an order (only owner can decrypt)
    function getOrderPrice(uint256 orderId) external view returns (euint64) {
        require(orderId < orderCount, "Invalid order");
        return _orders[orderId].price;
    }

    /// @notice Get encrypted amount of an order (only owner can decrypt)
    function getOrderAmount(uint256 orderId) external view returns (euint64) {
        require(orderId < orderCount, "Invalid order");
        return _orders[orderId].amount;
    }
}

```

{% endtab %}

{% tab title="PrivateOrderBook.ts" %}

```typescript
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { PrivateOrderBook, PrivateOrderBook__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  buyer: HardhatEthersSigner;
  seller: HardhatEthersSigner;
  trader3: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "PrivateOrderBook"
  )) as PrivateOrderBook__factory;
  const orderBook = (await factory.deploy()) as PrivateOrderBook;
  const orderBookAddress = await orderBook.getAddress();

  return { orderBook, orderBookAddress };
}

/**
 * Private Order Book Tests
 *
 * Tests encrypted order placement and FHE-based order matching.
 * Demonstrates MEV-resistant trading where prices and amounts stay hidden.
 */
describe("PrivateOrderBook", function () {
  let signers: Signers;
  let orderBook: PrivateOrderBook;
  let orderBookAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      buyer: ethSigners[1],
      seller: ethSigners[2],
      trader3: ethSigners[3],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    ({ orderBook, orderBookAddress } = await deployFixture());
  });

  describe("Initialization", function () {
    it("should initialize with zero orders", async function () {
      expect(await orderBook.orderCount()).to.equal(0n);
      expect(await orderBook.tradeCount()).to.equal(0n);
    });
  });

  describe("Placing Orders", function () {
    it("should place a buy order with encrypted price and amount", async function () {
      // 🔐 Encrypt buy order: price=100, amount=50
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100) // Price
        .add64(50) // Amount
        .encrypt();

      await expect(
        orderBook
          .connect(signers.buyer)
          .placeBuyOrder(enc.handles[0], enc.handles[1], enc.inputProof)
      )
        .to.emit(orderBook, "OrderPlaced")
        .withArgs(0, signers.buyer.address, 0); // OrderType.Buy = 0

      expect(await orderBook.orderCount()).to.equal(1n);
    });

    it("should place a sell order with encrypted price and amount", async function () {
      // 🔐 Encrypt sell order: price=95, amount=30
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.seller.address)
        .add64(95) // Price
        .add64(30) // Amount
        .encrypt();

      await expect(
        orderBook
          .connect(signers.seller)
          .placeSellOrder(enc.handles[0], enc.handles[1], enc.inputProof)
      )
        .to.emit(orderBook, "OrderPlaced")
        .withArgs(0, signers.seller.address, 1); // OrderType.Sell = 1

      expect(await orderBook.orderCount()).to.equal(1n);
    });

    it("should track multiple orders from same trader", async function () {
      // First order
      const enc1 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc1.handles[0], enc1.handles[1], enc1.inputProof);

      // Second order
      const enc2 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(105)
        .add64(25)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc2.handles[0], enc2.handles[1], enc2.inputProof);

      const traderOrders = await orderBook.getTraderOrders(
        signers.buyer.address
      );
      expect(traderOrders.length).to.equal(2);
    });
  });

  describe("Order Matching", function () {
    it("should match buy and sell orders", async function () {
      // Buyer places order: price=100, amount=50
      const buyEnc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(buyEnc.handles[0], buyEnc.handles[1], buyEnc.inputProof);

      // Seller places order: price=95, amount=30 (lower price = should match)
      const sellEnc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.seller.address)
        .add64(95)
        .add64(30)
        .encrypt();
      await orderBook
        .connect(signers.seller)
        .placeSellOrder(
          sellEnc.handles[0],
          sellEnc.handles[1],
          sellEnc.inputProof
        );

      // 🔀 Match orders using FHE comparison
      await expect(orderBook.matchOrders(0, 1))
        .to.emit(orderBook, "OrdersMatched")
        .withArgs(0, 1);

      // Check order status changed to Matched
      const buyInfo = await orderBook.getOrderInfo(0);
      expect(buyInfo.status).to.equal(1); // Matched
    });

    it("should reject matching with invalid order IDs", async function () {
      await expect(orderBook.matchOrders(0, 1)).to.be.revertedWith(
        "Invalid buy order"
      );
    });

    it("should reject self-matching", async function () {
      // Same trader places buy and sell
      const buyEnc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(buyEnc.handles[0], buyEnc.handles[1], buyEnc.inputProof);

      const sellEnc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(95)
        .add64(30)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeSellOrder(
          sellEnc.handles[0],
          sellEnc.handles[1],
          sellEnc.inputProof
        );

      await expect(orderBook.matchOrders(0, 1)).to.be.revertedWith(
        "Self-matching not allowed"
      );
    });

    it("should reject matching wrong order types", async function () {
      // Place two buy orders
      const enc1 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc1.handles[0], enc1.handles[1], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.seller.address)
        .add64(95)
        .add64(30)
        .encrypt();
      await orderBook
        .connect(signers.seller)
        .placeBuyOrder(enc2.handles[0], enc2.handles[1], enc2.inputProof);

      // Try to match two buy orders
      await expect(orderBook.matchOrders(0, 1)).to.be.revertedWith(
        "Not a sell order"
      );
    });
  });

  describe("Order Cancellation", function () {
    it("should allow trader to cancel their own order", async function () {
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc.handles[0], enc.handles[1], enc.inputProof);

      await expect(orderBook.connect(signers.buyer).cancelOrder(0))
        .to.emit(orderBook, "OrderCancelled")
        .withArgs(0);

      const info = await orderBook.getOrderInfo(0);
      expect(info.status).to.equal(2); // Cancelled
    });

    it("should reject cancellation by non-owner", async function () {
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc.handles[0], enc.handles[1], enc.inputProof);

      await expect(
        orderBook.connect(signers.seller).cancelOrder(0)
      ).to.be.revertedWith("Not your order");
    });

    it("should reject matching cancelled orders", async function () {
      // Place orders
      const buyEnc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(buyEnc.handles[0], buyEnc.handles[1], buyEnc.inputProof);

      const sellEnc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.seller.address)
        .add64(95)
        .add64(30)
        .encrypt();
      await orderBook
        .connect(signers.seller)
        .placeSellOrder(
          sellEnc.handles[0],
          sellEnc.handles[1],
          sellEnc.inputProof
        );

      // Cancel buy order
      await orderBook.connect(signers.buyer).cancelOrder(0);

      // Try to match
      await expect(orderBook.matchOrders(0, 1)).to.be.revertedWith(
        "Buy order not active"
      );
    });
  });

  describe("View Functions", function () {
    it("should return correct order info", async function () {
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc.handles[0], enc.handles[1], enc.inputProof);

      const info = await orderBook.getOrderInfo(0);
      expect(info.trader).to.equal(signers.buyer.address);
      expect(info.orderType).to.equal(0); // Buy
      expect(info.status).to.equal(0); // Active
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("Edge Cases", function () {
    it("should handle minimum price and amount", async function () {
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(1) // Minimum price
        .add64(1) // Minimum amount
        .encrypt();

      await expect(
        orderBook
          .connect(signers.buyer)
          .placeBuyOrder(enc.handles[0], enc.handles[1], enc.inputProof)
      ).to.not.be.reverted;
    });

    it("should handle large price values", async function () {
      const enc = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(BigInt("18446744073709551615")) // Max uint64
        .add64(1000)
        .encrypt();

      await expect(
        orderBook
          .connect(signers.buyer)
          .placeBuyOrder(enc.handles[0], enc.handles[1], enc.inputProof)
      ).to.not.be.reverted;
    });

    it("should allow multiple traders to place orders", async function () {
      // Three different traders place orders
      const enc1 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.buyer.address)
        .add64(100)
        .add64(50)
        .encrypt();
      await orderBook
        .connect(signers.buyer)
        .placeBuyOrder(enc1.handles[0], enc1.handles[1], enc1.inputProof);

      const enc2 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.seller.address)
        .add64(95)
        .add64(30)
        .encrypt();
      await orderBook
        .connect(signers.seller)
        .placeSellOrder(enc2.handles[0], enc2.handles[1], enc2.inputProof);

      const enc3 = await fhevm
        .createEncryptedInput(orderBookAddress, signers.trader3.address)
        .add64(98)
        .add64(40)
        .encrypt();
      await orderBook
        .connect(signers.trader3)
        .placeSellOrder(enc3.handles[0], enc3.handles[1], enc3.inputProof);

      expect(await orderBook.orderCount()).to.equal(3n);
    });
  });
});

```

{% endtab %}

{% endtabs %}
