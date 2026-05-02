export interface KLine {
  close: string;
  end: string;
  high: string;
  low: string;
  open: string;
  quoteVolume: string;
  start: string;
  trades: string;
  volume: string;
}

export interface Trade {
  id: number;
  isBuyerMaker: boolean;
  price: string;
  quantity: string;
  quoteQuantity: string;
  timestamp: number;
}

export interface Depth {
  bids: [string, string][];
  asks: [string, string][];
  lastUpdateId: string;
}

export interface Ticker {
  symbol: string;
  name: string;
  baseCurrency: string;
  quoteCurrency: string;
  category: "SPOT" | "FUTURES";
  firstPrice: string | null;
  high: string | null;
  lastPrice: string | null;
  low: string | null;
  priceChange: string | null;
  priceChangePercent: string | null;
  quoteVolume: string | null;
  trades: string | null;
  volume: string | null;
}

export interface OpenInterest {
  openInterest: string;
  symbol: string;
  timestamp: number;
}

export interface SparklinePoint {
  close: string;
  end: string;
}

export interface MarketDataKlines {
  data: SparklinePoint[];
  symbol: string;
}

export type MarketDataKlinesResponse = MarketDataKlines[];
