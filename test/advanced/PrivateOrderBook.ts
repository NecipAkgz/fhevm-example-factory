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
