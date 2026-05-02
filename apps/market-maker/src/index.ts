import axios from "axios";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const USER_ID = process.env.MARKET_MAKER_USER_ID ?? "5";

const TICK_MS = 200;
const REAL_PRICE_REFRESH_MS = 60_000;
const RAMP_WINDOW_MS = 60_000;
const LADDER_LEVELS = 8;
const LADDER_SPREAD_BPS = 25;
const STALE_BPS = 60;
const TAKER_MAX_QTY = 0.5;
const TAKER_MIN_QTY = 0.05;
const MAKER_QTY = 1;

interface Ticker {
  symbol: string;
  lastPrice: string | null;
}

interface Depth {
  bids: [string, string][];
  asks: [string, string][];
}

interface OpenOrder {
  orderId: string;
  side: "buy" | "sell";
  price: number | string;
  market: string;
}

const realPrices = new Map<string, number>();
const targetSnapshots = new Map<
  string,
  { from: number; to: number; startedAt: number }
>();

async function fetchTickers(): Promise<Ticker[]> {
  const { data } = await axios.get<Ticker[]>(`${BASE_URL}/api/v1/tickers`);
  return data.filter((t) => t.lastPrice !== null && Number(t.lastPrice) > 0);
}

async function refreshRealPrices() {
  try {
    const tickers = await fetchTickers();
    const now = Date.now();
    for (const t of tickers) {
      const real = Number(t.lastPrice);
      const prev = realPrices.get(t.symbol);
      realPrices.set(t.symbol, real);
      if (prev === undefined) {
        targetSnapshots.set(t.symbol, { from: real, to: real, startedAt: now });
      } else {
        const snap = targetSnapshots.get(t.symbol);
        const fromPrice = snap ? rampedPrice(snap, now) : prev;
        targetSnapshots.set(t.symbol, {
          from: fromPrice,
          to: real,
          startedAt: now,
        });
      }
    }
  } catch (err) {
    console.error("refreshRealPrices error:", (err as Error).message);
  }
}

function rampedPrice(
  snap: { from: number; to: number; startedAt: number },
  now: number,
) {
  const t = Math.min(1, (now - snap.startedAt) / RAMP_WINDOW_MS);
  return snap.from + (snap.to - snap.from) * t;
}

function targetFor(symbol: string): number | null {
  const snap = targetSnapshots.get(symbol);
  if (!snap) return null;
  return rampedPrice(snap, Date.now());
}

async function getDepth(market: string): Promise<Depth | null> {
  try {
    const { data } = await axios.get<Depth>(
      `${BASE_URL}/api/v1/depth?symbol=${market}`,
    );
    return data;
  } catch {
    return null;
  }
}

async function getOpenOrders(market: string): Promise<OpenOrder[]> {
  try {
    const { data } = await axios.get<OpenOrder[]>(
      `${BASE_URL}/api/v1/order/open?userId=${USER_ID}&market=${market}`,
    );
    return data;
  } catch {
    return [];
  }
}

function fmtPrice(p: number) {
  return p.toFixed(2);
}

function fmtQty(q: number) {
  return q.toFixed(3);
}

async function placeOrder(
  market: string,
  side: "buy" | "sell",
  price: number,
  quantity: number,
) {
  try {
    await axios.post(`${BASE_URL}/api/v1/order`, {
      market,
      price: fmtPrice(price),
      quantity: fmtQty(quantity),
      side,
      userId: USER_ID,
    });
  } catch {
    /* engine may reject — ignore */
  }
}

async function cancelOrder(market: string, orderId: string) {
  try {
    await axios.delete(`${BASE_URL}/api/v1/order`, {
      data: { orderId, market },
    });
  } catch {
    /* ignore */
  }
}

function bestBidAsk(depth: Depth | null): {
  bid: number | null;
  ask: number | null;
} {
  if (!depth) return { bid: null, ask: null };
  let bid: number | null = null;
  let ask: number | null = null;
  for (const [p] of depth.bids) {
    const v = Number(p);
    if (bid === null || v > bid) bid = v;
  }
  for (const [p] of depth.asks) {
    const v = Number(p);
    if (ask === null || v < ask) ask = v;
  }
  return { bid, ask };
}

async function tickMarket(market: string) {
  const target = targetFor(market);
  if (!target || target <= 0) return;

  const [depth, openOrders] = await Promise.all([
    getDepth(market),
    getOpenOrders(market),
  ]);

  const { bid, ask } = bestBidAsk(depth);
  const localMid =
    bid !== null && ask !== null ? (bid + ask) / 2 : (bid ?? ask ?? target);

  const staleAbs = (target * STALE_BPS) / 10_000;
  const cancels: Promise<void>[] = [];
  for (const o of openOrders) {
    const p = Number(o.price);
    const tooFar = Math.abs(p - target) > staleAbs;
    const wrongSide =
      (o.side === "buy" && p >= target) || (o.side === "sell" && p <= target);
    if (tooFar || wrongSide || Math.random() < 0.15) {
      cancels.push(cancelOrder(market, o.orderId));
    }
  }

  const places: Promise<void>[] = [];

  // taker push toward target — causes trades + price move
  const diff = target - localMid;
  const driftBps = (Math.abs(diff) / target) * 10_000;
  if (driftBps > 2 && bid !== null && ask !== null) {
    const qty = TAKER_MIN_QTY + Math.random() * (TAKER_MAX_QTY - TAKER_MIN_QTY);
    if (diff > 0) {
      // need to push up — buy at ask
      places.push(placeOrder(market, "buy", ask * 1.0005, qty));
    } else {
      places.push(placeOrder(market, "sell", bid * 0.9995, qty));
    }
  } else {
    // even at target — random taker churn for volatility
    if (bid !== null && ask !== null && Math.random() < 0.5) {
      const qty = TAKER_MIN_QTY + Math.random() * 0.15;
      const side: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
      const price = side === "buy" ? ask : bid;
      places.push(placeOrder(market, side, price, qty));
    }
  }

  // refresh maker ladder around target
  const spread = (target * LADDER_SPREAD_BPS) / 10_000;
  for (let i = 1; i <= LADDER_LEVELS; i++) {
    const jitter = 1 + (Math.random() - 0.5) * 0.3;
    const offset = (spread * i * jitter) / LADDER_LEVELS;
    const bidPrice = target - offset;
    const askPrice = target + offset;
    const qty = MAKER_QTY * (0.5 + Math.random());
    places.push(placeOrder(market, "buy", bidPrice, qty));
    places.push(placeOrder(market, "sell", askPrice, qty));
  }

  await Promise.allSettled([...cancels, ...places]);
}

function startMarketLoop(market: string) {
  const run = async () => {
    try {
      await tickMarket(market);
    } catch (err) {
      console.error(`tick ${market}:`, (err as Error).message);
    }
    setTimeout(run, TICK_MS + Math.floor(Math.random() * 100));
  };
  run();
}

async function main() {
  await new Promise((r) => setTimeout(r, 2000));
  await refreshRealPrices();
  setInterval(refreshRealPrices, REAL_PRICE_REFRESH_MS);

  const markets = Array.from(realPrices.keys());
  console.log(`market-maker starting on ${markets.length} markets`);
  for (const m of markets) {
    startMarketLoop(m);
  }
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
