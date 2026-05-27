import axios from "axios";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const SERVICE_TOKEN = process.env.MARKET_MAKER_SERVICE_TOKEN;

const orderClient = axios.create({
  baseURL: BASE_URL,
  headers: SERVICE_TOKEN
    ? {
        "x-market-maker-token": SERVICE_TOKEN,
      }
    : undefined,
});

const TICK_MS = Number(process.env.TICK_MS ?? 1500);
const REAL_PRICE_REFRESH_MS = 60_000;
const RAMP_WINDOW_MS = 60_000;
const LADDER_LEVELS = 4;
const MAX_OPEN_PER_SIDE = LADDER_LEVELS;
const LADDER_SPREAD_BPS = 25;
const STALE_BPS = 60;
const TAKER_QTY = Number(process.env.MARKET_MAKER_TAKER_SIZE ?? 1);
const MAKER_QTY = Number(process.env.MARKET_MAKER_ORDER_SIZE ?? 1);

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
  quantity: number | string;
  market: string;
}

const realPrices = new Map<string, number>();
const targetSnapshots = new Map<
  string,
  { from: number; to: number; startedAt: number }
>();

const DEFAULT_PRICE = 100;

async function fetchTickers(): Promise<Ticker[]> {
  const { data } = await axios.get<Ticker[]>(`${BASE_URL}/api/v1/tickers`);
  return data;
}

function counterpart(sym: string) {
  return sym.endsWith("_PERP") ? sym.slice(0, -"_PERP".length) : `${sym}_PERP`;
}

async function refreshRealPrices() {
  try {
    const tickers = await fetchTickers();
    const priceMap = new Map<string, number>();
    for (const t of tickers) {
      const v = Number(t.lastPrice);
      if (Number.isFinite(v) && v > 0) priceMap.set(t.symbol, v);
    }
    const now = Date.now();
    for (const t of tickers) {
      const direct = priceMap.get(t.symbol);
      const fallback = priceMap.get(counterpart(t.symbol));
      const real = direct ?? fallback ?? DEFAULT_PRICE;
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
    const { data } = await orderClient.get<OpenOrder[]>("/api/v1/order/open", {
      params: { market },
    });
    return data;
  } catch {
    return [];
  }
}

function fmtPrice(p: number) {
  return p.toFixed(2);
}

function fmtQty(q: number) {
  return Math.max(1, Math.round(q)).toString();
}

async function placeOrder(
  market: string,
  side: "buy" | "sell",
  price: number,
  quantity: number,
) {
  try {
    await orderClient.post("/api/v1/order", {
      market,
      price: fmtPrice(price),
      quantity: fmtQty(quantity),
      side,
    });
  } catch {
    /* engine may reject — ignore */
  }
}

async function cancelOrder(market: string, orderId: string) {
  try {
    await orderClient.delete("/api/v1/order", {
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
  const cancelledOrderIds = new Set<string>();
  for (const o of openOrders) {
    const p = Number(o.price);
    const q = Number(o.quantity);
    const tooFar = Math.abs(p - target) > staleAbs;
    const fractionalSize = !Number.isInteger(q) || q < 1;
    const wrongSide =
      (o.side === "buy" && p >= target) || (o.side === "sell" && p <= target);
    if (fractionalSize || tooFar || wrongSide || Math.random() < 0.15) {
      cancelledOrderIds.add(o.orderId);
      cancels.push(cancelOrder(market, o.orderId));
    }
  }

  const places: Promise<void>[] = [];
  const activeOrders = openOrders.filter(
    (o) => !cancelledOrderIds.has(o.orderId),
  );
  const activeBids = activeOrders.filter((o) => o.side === "buy").length;
  const activeAsks = activeOrders.filter((o) => o.side === "sell").length;
  let bidPlaces = 0;
  let askPlaces = 0;

  // taker push toward target — causes trades + price move
  const diff = target - localMid;
  const driftBps = (Math.abs(diff) / target) * 10_000;
  if (driftBps > 2 && bid !== null && ask !== null) {
    if (diff > 0) {
      // need to push up — buy at ask
      places.push(placeOrder(market, "buy", ask * 1.0005, TAKER_QTY));
    } else {
      places.push(placeOrder(market, "sell", bid * 0.9995, TAKER_QTY));
    }
  } else {
    // even at target — random taker churn for volatility
    if (bid !== null && ask !== null && Math.random() < 0.5) {
      const side: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
      const price = side === "buy" ? ask : bid;
      places.push(placeOrder(market, side, price, TAKER_QTY));
    }
  }

  // refresh maker ladder around target
  const spread = (target * LADDER_SPREAD_BPS) / 10_000;
  for (let i = 1; i <= LADDER_LEVELS; i++) {
    const jitter = 1 + (Math.random() - 0.5) * 0.3;
    const offset = (spread * i * jitter) / LADDER_LEVELS;
    const bidPrice = target - offset;
    const askPrice = target + offset;
    if (activeBids + bidPlaces < MAX_OPEN_PER_SIDE) {
      bidPlaces++;
      places.push(placeOrder(market, "buy", bidPrice, MAKER_QTY));
    }
    if (activeAsks + askPlaces < MAX_OPEN_PER_SIDE) {
      askPlaces++;
      places.push(placeOrder(market, "sell", askPrice, MAKER_QTY));
    }
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
  await new Promise((r) => setTimeout(r, 5000));
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
