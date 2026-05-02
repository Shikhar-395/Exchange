import axios from "axios";
import {
  Depth,
  KLine,
  MarketDataKlinesResponse,
  OpenInterest,
  Ticker,
  Trade,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_EXCHANGE_API_URL ?? "http://localhost:3000/api/v1";

const API_ROOT = BASE_URL.replace(/\/api\/v1$/, "");

export async function getTicker(market: string): Promise<Ticker> {
  const tickers = await getTickers();
  const ticker = tickers.find((t) => t.symbol === market);
  if (!ticker) throw new Error(`No ticker found for ${market}`);
  return ticker;
}

export async function getTickers(): Promise<Ticker[]> {
  const response = await axios.get(`${BASE_URL}/tickers`);
  return response.data;
}

export async function getDepth(market: string): Promise<Depth> {
  const response = await axios.get(`${BASE_URL}/depth?symbol=${market}`);
  return response.data;
}

export async function getTrades(market: string): Promise<Trade[]> {
  const response = await axios.get(`${BASE_URL}/trades?symbol=${market}`);
  return response.data;
}

export async function getKlines(
  market: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<KLine[]> {
  const response = await axios.get(
    `${BASE_URL}/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`,
  );
  const data: KLine[] = response.data;
  return data.sort((x, y) => (Number(x.end) < Number(y.end) ? -1 : 1));
}

export async function getOpenInterest(): Promise<OpenInterest[]> {
  const response = await axios.get(`${BASE_URL}/openInterest`);
  return response.data;
}

export async function getMarketDataKlines(
  symbol?: string,
): Promise<MarketDataKlinesResponse> {
  const now = Math.floor(Date.now() / 1000);
  const weekAgo = now - 7 * 24 * 60 * 60;
  const params = new URLSearchParams({
    interval: "6h",
    startTime: String(weekAgo),
    endTime: String(now),
    ...(symbol ? { symbol } : {}),
  });
  const response = await axios.get(
    `${API_ROOT}/wapi/v1/marketDataKlines?${params}`,
  );
  return response.data;
}

export async function createOrder(payload: {
  market: string;
  price: string;
  quantity: string;
  side: "buy" | "sell";
  userId: string;
}) {
  const response = await axios.post(`${BASE_URL}/order`, payload, {
    withCredentials: true,
  });
  return response.data;
}
