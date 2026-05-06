import fs from "fs";
import path from "path";

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR ?? ".";
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, "snapshot.json");

import {
  BASE_CURRENCY,
  CANCEL_ORDER,
  CREATE_ORDER,
  GET_DEPTH,
  GET_OPEN_ORDERS,
  ON_RAMP,
  ORDER_UPDATE,
  TRADE_ADDED,
} from "@repo/common/consts";
import { prisma } from "@repo/database/client";
import { RedisManager } from "../redisManager";
import { MessageToEngine } from "@repo/common/engineMessages";
import { Orderbook } from "./orderbook";
import { Fill, Order } from "@repo/common/orderbook";

interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

export class Engine {
  private orderbooks: Orderbook[] = [];
  private balances: Map<string, UserBalance> = new Map();

  constructor() {
    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 3);
  }

  async init() {
    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync(SNAPSHOT_PATH);
      }
    } catch (e) {
      console.log("No snapshot found");
    }

    if (snapshot) {
      const parsed = JSON.parse(snapshot.toString());
      this.orderbooks = parsed.orderbooks.map(
        (o: any) =>
          new Orderbook(
            o.market,
            o.bids,
            o.asks,
            o.lastTradeId,
            o.currentPrice,
          ),
      );
      this.balances = new Map(parsed.balances);
    } else {
      const markets = await prisma.market.findMany({
        where: { isActive: true },
        select: { symbol: true },
      });
      console.log(`Loading ${markets.length} orderbooks from DB`);
      this.orderbooks = markets.map(
        (m) => new Orderbook(m.symbol, [], [], 0, 0),
      );
      this.setBaseBalances();
    }

    await prisma.$disconnect();
  }

  saveSnapshot() {
    const snapshot = {
      orderbooks: this.orderbooks.map((o) => o.getSnapshot()),
      balances: Array.from(this.balances.entries()),
    };
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
  }

  process({
    message,
    clientId,
  }: {
    message: MessageToEngine;
    clientId: string;
  }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const { executedQty, fills, orderId } = this.createOrder(
            message.data.market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId,
          );
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty,
              fills: fills.map((f) => ({
                price: f.price,
                qty: f.qty,
                tradeId: f.tradeId,
              })),
            },
          });
        } catch (e) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: { orderId: "", executedQty: 0, remainingQty: 0 },
          });
        }
        break;

      case CANCEL_ORDER:
        try {
          const { orderId, market: cancelMarket } = message.data;
          const cancelOrderbook = this.orderbooks.find(
            (o) => o.ticker() === cancelMarket,
          );
          if (!cancelOrderbook) {
            console.log("from cancel order");
            throw new Error("No orderbook found");
          }

          const order =
            cancelOrderbook.asks.find((o) => o.orderId === orderId) ||
            cancelOrderbook.bids.find((o) => o.orderId === orderId);
          if (!order) {
            console.log("from cancel order 2 ");
            throw new Error("No order found");
          }

          const quoteAsset = cancelOrderbook.quoteAsset;
          const baseAsset = cancelOrderbook.baseAsset;

          if (order.side === "buy") {
            const price = cancelOrderbook.cancelBid(order);
            const leftQuantity = (order.quantity - order.filled) * order.price;
            this.ensureBalance(order.userId, quoteAsset);
            this.balances.get(order.userId)![quoteAsset]!.available +=
              leftQuantity;
            this.balances.get(order.userId)![quoteAsset]!.locked -=
              leftQuantity;
            if (price) this.sendUpdatedDepthAt(price.toString(), cancelMarket);
          } else {
            const price = cancelOrderbook.cancelAsk(order);
            const leftQuantity = order.quantity - order.filled;
            this.ensureBalance(order.userId, baseAsset);
            this.balances.get(order.userId)![baseAsset]!.available +=
              leftQuantity;
            this.balances.get(order.userId)![baseAsset]!.locked -= leftQuantity;
            if (price) this.sendUpdatedDepthAt(price.toString(), cancelMarket);
          }

          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: { orderId, executedQty: 0, remainingQty: 0 },
          });
        } catch (e) {
          console.log("Error while cancelling order:", e);
        }
        break;

      case GET_OPEN_ORDERS:
        try {
          const openOrderbook = this.orderbooks.find(
            (o) => o.ticker() === message.data.market,
          );
          const openOrders =
            openOrderbook?.getOpenOrders(message.data.userId) ?? [];
          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: openOrders.map((o) => ({
              orderId: o.orderId,
              executedQty: o.filled,
              price: o.price.toString(),
              quantity: o.quantity.toString(),
              side: o.side,
              userId: o.userId,
            })),
          });
        } catch (e) {
          console.log(e);
        }
        break;

      case ON_RAMP:
        this.onRamp(message.data.userId, Number(message.data.amount));
        break;

      case GET_DEPTH:
        try {
          const orderbook = this.orderbooks.find(
            (o) => o.ticker() === message.data.market,
          );
          if (!orderbook) {
            throw new Error("No orderbook found");
          }
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: { market: message.data.market, ...orderbook.getDepth() },
          });
        } catch {
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: { market: message.data.market, bids: [], asks: [] },
          });
        }
        break;
    }
  }

  createOrder(
    market: string,
    price: string,
    quantity: string,
    side: "buy" | "sell",
    userId: string,
  ) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);
    if (!orderbook) {
      console.log(`[createOrder] no orderbook for market=${market}`);
      throw new Error("No orderbook found");
    }

    const { baseAsset, quoteAsset } = orderbook;

    const userBalance = this.balances.get(userId);

    this.checkAndLockFunds(
      baseAsset,
      quoteAsset,
      side,
      userId,
      price,
      quantity,
    );

    const order: Order = {
      price: Number(price),
      quantity: Number(quantity),
      orderId:
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
      filled: 0,
      side,
      userId,
    };

    const { fills, executedQty } = orderbook.addOrder(order);

    this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty);
    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publisWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, userId, market);
    return { executedQty, fills, orderId: order.orderId };
  }

  updateDbOrders(
    order: Order,
    executedQty: number,
    fills: Fill[],
    market: string,
  ) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: order.orderId,
        executedQty,
        market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      },
    });
    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: ORDER_UPDATE,
        data: { orderId: fill.markerOrderId, executedQty: fill.qty },
      });
    });
  }

  createDbTrades(fills: Fill[], market: string, userId: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: TRADE_ADDED,
        data: {
          market,
          id: fill.tradeId.toString(),
          isBuyerMaker: fill.otherUserId === userId,
          price: fill.price,
          quantity: fill.qty.toString(),
          quoteQuantity: (fill.qty * Number(fill.price)).toString(),
          timestamp: Date.now(),
        },
      });
    });
  }

  publishWsTrades(fills: Fill[], userId: string, market: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: fill.otherUserId === userId,
          p: fill.price,
          q: fill.qty.toString(),
          s: market,
        },
      });
    });
  }

  sendUpdatedDepthAt(price: string, market: string) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);
    if (!orderbook) return;
    const depth = orderbook.getDepth();
    const updatedBids = depth.bids.filter((x) => x[0] === price);
    const updatedAsks = depth.asks.filter((x) => x[0] === price);
    RedisManager.getInstance().publishMessage(`depth@${market}`, {
      stream: `depth@${market}`,
      data: {
        a: updatedAsks.length ? updatedAsks : [[price, "0"]],
        b: updatedBids.length ? updatedBids : [[price, "0"]],
        e: "depth",
      },
    });
  }

  publisWsDepthUpdates(
    fills: Fill[],
    price: string,
    side: "buy" | "sell",
    market: string,
  ) {
    const orderbook = this.orderbooks.find((o) => o.ticker() === market);
    if (!orderbook) return;
    const depth = orderbook.getDepth();

    if (side === "buy") {
      const updatedAsks = depth.asks.filter((x) =>
        fills.map((f) => f.price).includes(x[0].toString()),
      );
      const updatedBid = depth.bids.find((x) => x[0] === price);
      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: { a: updatedAsks, b: updatedBid ? [updatedBid] : [], e: "depth" },
      });
    } else {
      const updatedBids = depth.bids.filter((x) =>
        fills.map((f) => f.price).includes(x[0].toString()),
      );
      const updatedAsk = depth.asks.find((x) => x[0] === price);
      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: { a: updatedAsk ? [updatedAsk] : [], b: updatedBids, e: "depth" },
      });
    }
  }

  private static TEST_USERS = new Set(["1", "2", "5"]);

  ensureBalance(userId: string, currency: string) {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, {});
    }
    if (!this.balances.get(userId)![currency]) {
      const available = Engine.TEST_USERS.has(userId) ? 100_000_000 : 0;
      this.balances.get(userId)![currency] = { available, locked: 0 };
    }
  }

  updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[],
    executedQty: number,
  ) {
    if (side === "buy") {
      fills.forEach((fill) => {
        const fillPrice = Number(fill.price);
        this.ensureBalance(fill.otherUserId, quoteAsset);
        this.ensureBalance(fill.otherUserId, baseAsset);
        this.balances.get(fill.otherUserId)![quoteAsset]!.available +=
          fill.qty * fillPrice;
        this.balances.get(userId)![quoteAsset]!.locked -= fill.qty * fillPrice;
        this.balances.get(fill.otherUserId)![baseAsset]!.locked -= fill.qty;
        this.balances.get(userId)![baseAsset]!.available += fill.qty;
      });
    } else {
      fills.forEach((fill) => {
        const fillPrice = Number(fill.price);
        this.ensureBalance(fill.otherUserId, quoteAsset);
        this.ensureBalance(fill.otherUserId, baseAsset);
        this.balances.get(fill.otherUserId)![quoteAsset]!.locked -=
          fill.qty * fillPrice;
        this.balances.get(userId)![quoteAsset]!.available +=
          fill.qty * fillPrice;
        this.balances.get(fill.otherUserId)![baseAsset]!.available += fill.qty;
        this.balances.get(userId)![baseAsset]!.locked -= fill.qty;
      });
    }
  }

  checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    userId: string,
    price: string,
    quantity: string,
  ) {
    this.ensureBalance(userId, quoteAsset);
    this.ensureBalance(userId, baseAsset);

    if (side === "buy") {
      const required = Number(quantity) * Number(price);
      if ((this.balances.get(userId)![quoteAsset]?.available ?? 0) < required) {
        throw new Error("Insufficient funds");
      }
      this.balances.get(userId)![quoteAsset]!.available -= required;
      this.balances.get(userId)![quoteAsset]!.locked += required;
    } else {
      const required = Number(quantity);
      if ((this.balances.get(userId)![baseAsset]?.available ?? 0) < required) {
        throw new Error("Insufficient funds");
      }
      this.balances.get(userId)![baseAsset]!.available -= required;
      this.balances.get(userId)![baseAsset]!.locked += required;
    }
  }

  onRamp(userId: string, amount: number) {
    this.ensureBalance(userId, BASE_CURRENCY);
    this.balances.get(userId)![BASE_CURRENCY]!.available += amount;
  }

  setBaseBalances() {
    // Test users: large USDC balance + common base assets for market making
    const testUsers = ["1", "2", "5"];
    const testAssets = ["SOL", "BTC", "ETH", "BNB", "XRP", "DOGE"];

    for (const userId of testUsers) {
      const balance: UserBalance = {
        [BASE_CURRENCY]: { available: 100_000_000, locked: 0 },
      };
      for (const asset of testAssets) {
        balance[asset] = { available: 100_000_000, locked: 0 };
      }
      this.balances.set(userId, balance);
    }
  }
}
