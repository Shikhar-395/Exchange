"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Candle, ChartManager } from "../utils/ChartManager";
import { getKlines } from "../utils/httpClient";
import { KLine, Ticker } from "../utils/types";
import { SignalingManager } from "../utils/SignalingManager";

type IntervalKey = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

interface IntervalConfig {
  label: string;
  bucketMs: number;
  rangeMs: number;
}

const INTERVALS: Record<IntervalKey, IntervalConfig> = {
  "1m": { label: "1m", bucketMs: 60_000, rangeMs: 4 * 3600_000 },
  "5m": { label: "5m", bucketMs: 5 * 60_000, rangeMs: 12 * 3600_000 },
  "15m": { label: "15m", bucketMs: 15 * 60_000, rangeMs: 24 * 3600_000 },
  "1h": { label: "1h", bucketMs: 3600_000, rangeMs: 7 * 86_400_000 },
  "4h": { label: "4h", bucketMs: 4 * 3600_000, rangeMs: 30 * 86_400_000 },
  "1d": { label: "1D", bucketMs: 86_400_000, rangeMs: 90 * 86_400_000 },
  "1w": { label: "1W", bucketMs: 7 * 86_400_000, rangeMs: 365 * 86_400_000 },
};

const ORDER: IntervalKey[] = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];

function toCandles(klines: KLine[]): Candle[] {
  return klines
    .map((k) => ({
      timestamp: new Date(k.end).getTime(),
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
      volume: parseFloat(k.volume) || 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);
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
          interval,
          Math.floor((now - cfg.rangeMs) / 1000),
          Math.floor(now / 1000),
        );
      } catch (e) {}

      if (cancelled || !chartRef.current) return;

      const candles = toCandles(klineData);
      const theme = {
        background: "#0b0f17",
        color: "#8a98ad",
        upColor: "#1fc7a1",
        downColor: "#e35d66",
        gridColor: "rgba(124,141,168,0.14)",
        crosshairColor: "rgba(124,141,168,0.55)",
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
  }, [market, cfg]);

  useEffect(() => {
    const id = `tradeview-trade-${market}`;
    const onTrade = (t: { price: string; quantity?: string }) => {
      const price = t.price ? parseFloat(t.price) : NaN;
      const qty = t.quantity ? parseFloat(t.quantity) : 0;
      if (!isFinite(price)) return;
      chartManagerRef.current?.updatePrice(price, isFinite(qty) ? qty : 0);
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
    const refetch = async () => {
      if (!chartManagerRef.current) return;
      try {
        const now = Date.now();
        const data = await getKlines(
          market,
          interval,
          Math.floor((now - cfg.rangeMs) / 1000),
          Math.floor(now / 1000),
        );
        chartManagerRef.current?.mergeData(toCandles(data));
      } catch (e) {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refetch);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refetch);
    };
  }, [market, interval, cfg]);

  useEffect(() => {
    return () => {
      chartManagerRef.current?.destroy();
      chartManagerRef.current = null;
    };
  }, []);

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between border-b border-[#1a2232] bg-[#0b0f17] px-2 py-1">
        <div className="flex gap-1">
          {ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setInterval(k)}
              className={
                "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors " +
                (interval === k
                  ? "bg-[#121c2c] text-[#dce4ef]"
                  : "text-[#7c8da6] hover:bg-[#121826] hover:text-[#c6d2e2]")
              }
            >
              {INTERVALS[k].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-[#7c8da6]">loading…</span>}
          <button
            onClick={() => chartManagerRef.current?.fit()}
            className="rounded px-1.5 py-0.5 text-[11px] text-[#7c8da6] hover:bg-[#121826] hover:text-[#c6d2e2]"
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
