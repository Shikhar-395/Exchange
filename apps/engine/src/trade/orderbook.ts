import { BASE_CURRENCY } from "@repo/common/consts";
import { Order } from "@repo/common/orderbook";

export class Orderbook {
  bids: Order[];
  asks: Order[];
  baseAsset: string;
  quoteAsset: string = BASE_CURRENCY;
  lastTradeId: number;
  currentPrice: number;

  constructor(
    baseAsset: string,
    bids: Order[],
    asks: Order[],
    lastTradeId: number,
    currentPrice: number,
  ) {
    this.bids = bids;
    this.asks = asks;
    this.baseAsset = baseAsset;
    this.lastTradeId = lastTradeId || 0;
    this.currentPrice = currentPrice || 0;
  }
}
