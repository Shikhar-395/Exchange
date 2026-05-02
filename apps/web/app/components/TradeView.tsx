"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Candle, ChartManager } from "../utils/ChartManager";
import { getKlines } from "../utils/httpClient";
import { KLine, Ticker } from "../utils/types";
import { useTheme } from "next-themes";
import { SignalingManager } from "../utils/SignalingManager";

type IntervalKey = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

interface IntervalConfig {
  label: string;
  bucketMs: number;
  source: "1m" | "1h" | "1w";
  rangeMs: number;
}

const INTERVALS: Record<IntervalKey, IntervalConfig> = {
  "1m": { label: "1m", bucketMs: 60_000, source: "1m", rangeMs: 4 * 3600_000 },
  "5m": {
    label: "5m",
    bucketMs: 5 * 60_000,
    source: "1m",
    rangeMs: 12 * 3600_000,
  },
  "15m": {
    label: "15m",
    bucketMs: 15 * 60_000,
    source: "1m",
    rangeMs: 24 * 3600_000,
  },
  "1h": {
    label: "1h",
    bucketMs: 3600_000,
    source: "1h",
    rangeMs: 7 * 86_400_000,
  },
  "4h": {
    label: "4h",
    bucketMs: 4 * 3600_000,
    source: "1h",
    rangeMs: 30 * 86_400_000,
  },
  "1d": {
    label: "1D",
    bucketMs: 86_400_000,
    source: "1h",
    rangeMs: 90 * 86_400_000,
  },
  "1w": {
    label: "1W",
    bucketMs: 7 * 86_400_000,
    source: "1w",
    rangeMs: 365 * 86_400_000,
  },
};

const ORDER: IntervalKey[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

function aggregate(klines: KLine[], bucketMs: number): Candle[] {
  if (!klines.length) return [];
  const buckets = new Map<number, Candle>();
  for (const k of klines) {
    const ts = new Date(k.end).getTime();
    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    const open = parseFloat(k.open);
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const close = parseFloat(k.close);
    const volume = parseFloat(k.volume) || 0;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, {
        timestamp: bucket,
        open,
        high,
        low,
        close,
        volume,
      });
    } else {
      existing.high = Math.max(existing.high, high);
      existing.low = Math.min(existing.low, low);
      existing.close = close;
      existing.volume = (existing.volume ?? 0) + volume;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);
  const { resolvedTheme } = useTheme();
  const [interval, setInterval] = useState<IntervalKey>("1h");
  const [loading, setLoading] = useState(false);

  const cfg = useMemo(() => INTERVALS[interval], [interval]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      let klineData: KLine[] = [];
      try {
        const now = Date.now();
        klineData = await getKlines(
          market,
          cfg.source,
          Math.floor((now - cfg.rangeMs) / 1000),
          Math.floor(now / 1000),
        );
      } catch (e) {}

      if (cancelled || !chartRef.current) return;

      const candles = aggregate(klineData, cfg.bucketMs);
      const isDark = resolvedTheme !== "light";
      const theme = {
        background: isDark ? "#0e0f14" : "#f6f8fc",
        color: isDark ? "#f4f4f6" : "#0d1526",
      };

      if (chartManagerRef.current) chartManagerRef.current.destroy();
      chartManagerRef.current = new ChartManager(
        chartRef.current,
        candles,
        theme,
        cfg.bucketMs,
        market,
      );
      setLoading(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [market, resolvedTheme, cfg]);

  useEffect(() => {
    const id = `tradeview-trade-${market}`;
    const onTrade = (t: { price: string }) => {
      const price = t.price ? parseFloat(t.price) : NaN;
      if (!isFinite(price)) return;
      chartManagerRef.current?.updatePrice(price);
    };
    SignalingManager.getInstance().registerCallback("trade", onTrade, id);
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`trade@${market}`],
    });
    return () => {
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`trade@${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback("trade", id);
    };
  }, [market]);

  useEffect(() => {
    return () => {
      chartManagerRef.current?.destroy();
      chartManagerRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col w-full" style={{ marginTop: 4 }}>
      <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-200/40 dark:border-zinc-800/60">
        <div className="flex gap-1">
          {ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setInterval(k)}
              className={
                "px-2 py-1 text-xs rounded-md transition-colors " +
                (interval === k
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800")
              }
            >
              {INTERVALS[k].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-zinc-500">loading…</span>}
          <button
            onClick={() => chartManagerRef.current?.fit()}
            className="px-2 py-1 text-xs rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
            title="Fit content"
          >
            Fit
          </button>
        </div>
      </div>
      <div ref={chartRef} style={{ height: "520px", width: "100%" }} />
    </div>
  );
}
