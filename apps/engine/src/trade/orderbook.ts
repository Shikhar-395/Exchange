import { BASE_CURRENCY } from "@repo/common/consts";
import { Order, Fill } from "@repo/common/orderbook";

export class Orderbook {
  bids: Order[];
  asks: Order[];
  market: string;
  baseAsset: string;
  quoteAsset: string;
  lastTradeId: number;
  currentPrice: number;

  constructor(
    market: string,
    bids: Order[],
    asks: Order[],
    lastTradeId: number,
    currentPrice: number,
  ) {
    this.market = market;
    const parts = market.split("_");
    this.baseAsset = parts[0] ?? "";
    this.quoteAsset = parts[1] ?? BASE_CURRENCY;
    this.bids = bids;
    this.asks = asks;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }

  ticker() {
    return this.market;
  }

  getSnapshot() {
    return {
      market: this.market,
      bids: this.bids,
      asks: this.asks,
      lastTradeId: this.lastTradeId,
      currentPrice: this.currentPrice,
    };
  }

  addOrder(order: Order): { executedQty: number; fills: Fill[] } {
    if (order.side === "buy") {
      const { executedQty, fills } = this.matchBid(order);
      order.filled = executedQty;
      if (executedQty !== order.quantity) {
        this.bids.push(order);
      }
      return { executedQty, fills };
    } else {
      const { executedQty, fills } = this.matchAsk(order);
      order.filled = executedQty;
      if (executedQty !== order.quantity) {
        this.asks.push(order);
      }
      return { executedQty, fills };
    }
  }

  matchBid(order: Order): { fills: Fill[]; executedQty: number } {
    const fills: Fill[] = [];
    let executedQty = 0;

    for (let i = 0; i < this.asks.length; i++) {
      const ask = this.asks[i]!;
      if (ask.price <= order.price && executedQty < order.quantity) {
        const filledQty = Math.min(order.quantity - executedQty, ask.quantity);
        executedQty += filledQty;
        ask.filled += filledQty;
        fills.push({
          price: ask.price.toString(),
          qty: filledQty,
          tradeId: this.lastTradeId++,
          otherUserId: ask.userId,
          markerOrderId: ask.orderId,
        });
      }
    }
    this.asks = this.asks.filter((a) => a.filled < a.quantity);
    return { fills, executedQty };
  }

  matchAsk(order: Order): { fills: Fill[]; executedQty: number } {
    const fills: Fill[] = [];
    let executedQty = 0;

    for (let i = 0; i < this.bids.length; i++) {
      const bid = this.bids[i]!;
      if (bid.price >= order.price && executedQty < order.quantity) {
        const amountRemaining = Math.min(
          order.quantity - executedQty,
          bid.quantity,
        );
        executedQty += amountRemaining;
        bid.filled += amountRemaining;
        fills.push({
          price: bid.price.toString(),
          qty: amountRemaining,
          tradeId: this.lastTradeId++,
          otherUserId: bid.userId,
          markerOrderId: bid.orderId,
        });
      }
    }
    this.bids = this.bids.filter((b) => b.filled < b.quantity);
    return { fills, executedQty };
  }

  getDepth() {
    const bidsObj: { [key: string]: number } = {};
    const asksObj: { [key: string]: number } = {};

    for (const order of this.bids) {
      bidsObj[order.price] = (bidsObj[order.price] ?? 0) + order.quantity;
    }
    for (const order of this.asks) {
      asksObj[order.price] = (asksObj[order.price] ?? 0) + order.quantity;
    }

    return {
      bids: Object.entries(bidsObj) as [string, string][],
      asks: Object.entries(asksObj) as [string, string][],
    };
  }

  getOpenOrders(userId: string): Order[] {
    return [
      ...this.asks.filter((x) => x.userId === userId),
      ...this.bids.filter((x) => x.userId === userId),
    ];
  }

  cancelBid(order: Order) {
    const index = this.bids.findIndex((x) => x.orderId === order.orderId);
    if (index !== -1) {
      const price = this.bids[index]!.price;
      this.bids.splice(index, 1);
      return price;
    }
  }

  cancelAsk(order: Order) {
    const index = this.asks.findIndex((x) => x.orderId === order.orderId);
    if (index !== -1) {
      const price = this.asks[index]!.price;
      this.asks.splice(index, 1);
      return price;
    }
  }
}
