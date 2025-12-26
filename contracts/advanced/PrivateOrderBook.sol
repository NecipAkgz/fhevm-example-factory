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
