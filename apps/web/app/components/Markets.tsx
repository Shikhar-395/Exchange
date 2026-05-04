"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticker } from "../utils/types";
import {
  getMarketDataKlines,
  getOpenInterest,
  getTickers,
} from "../utils/httpClient";

function formatUsd(value: string | null): string {
  if (!value) return "—";
  const num = Number(value);
  if (num >= 1_000_000) return `$${Math.floor(num / 100_000) / 10}M`;
  if (num >= 1_000) return `$${Math.floor(num / 100) / 10}K`;
  return `$${num.toFixed(2)}`;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2)
    return <span className="text-sm text-[var(--auth-text-muted)]">—</span>;
  const weekUp = points[points.length - 1] >= points[0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 80;
  const h = 30;
  const coords = points
    .map(
      (p, i) =>
        `${(i / (points.length - 1)) * w},${h - ((p - min) / range) * h}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={coords}
        fill="none"
        stroke={weekUp ? "#4ade80" : "#f87171"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Category = "SPOT" | "FUTURES";
const PINNED_TOKEN_ORDER = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "BNB",
  "DOGE",
  "ADA",
  "AVAX",
  "LINK",
  "SUI",
  "TON",
  "DOT",
  "LTC",
  "NEAR",
  "PEPE",
] as const;

const topSections = [
  {
    title: "New",
    rows: [
      { symbol: "PEPE-PERP", price: "$0.00001234", change: 4.21 },
      { symbol: "NEAR-PERP", price: "$5.12", change: 2.18 },
      { symbol: "TON-PERP", price: "$5.78", change: -1.04 },
      { symbol: "SUI-PERP", price: "$3.45", change: 3.67 },
      { symbol: "LINK-PERP", price: "$23.40", change: 1.1 },
    ],
  },
  {
    title: "Top Movers",
    rows: [
      { symbol: "DOGE-PERP", price: "$0.18", change: 8.46 },
      { symbol: "AVAX-PERP", price: "$36.20", change: 6.51 },
      { symbol: "ADA-PERP", price: "$0.62", change: -3.64 },
      { symbol: "DOT-PERP", price: "$7.85", change: 5.73 },
      { symbol: "LTC-PERP", price: "$92.10", change: -2.13 },
    ],
  },
  {
    title: "Popular",
    rows: [
      { symbol: "BTC-PERP", price: "$77,264.60", change: 1.53 },
      { symbol: "ETH-PERP", price: "$2,281.99", change: 0.71 },
      { symbol: "SOL-PERP", price: "$83.90", change: 0.82 },
      { symbol: "XRP-PERP", price: "$2.34", change: 1.2 },
      { symbol: "BNB-PERP", price: "$612.40", change: 0.45 },
    ],
  },
];

export const Markets = () => {
  const [tickers, setTickers] = useState<Ticker[]>();
  const [category, setCategory] = useState<Category>("FUTURES");
  const [oiMap, setOiMap] = useState<Map<string, string>>(new Map());
  const [klineMap, setKlineMap] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    getTickers()
      .then(setTickers)
      .catch(() => setTickers([]));

    getOpenInterest()
      .then((data) =>
        setOiMap(new Map(data.map((d) => [d.symbol, d.openInterest]))),
      )
      .catch(() => {});

    getMarketDataKlines()
      .then((arr) => {
        const map = new Map(
          arr.map((d) => [d.symbol, d.data.map((p) => Number(p.close))]),
        );
        setKlineMap(map);
      })
      .catch(() => {});
  }, []);

  const filtered = tickers?.filter((t) => {
    const matchCat = t.category === category;
    return matchCat;
  });
  const ordered = filtered
    ? [...filtered].sort((a, b) => {
        const tokenA = (
          a.baseCurrency ||
          a.symbol.split(/[_-]/)[0] ||
          ""
        ).toUpperCase();
        const tokenB = (
          b.baseCurrency ||
          b.symbol.split(/[_-]/)[0] ||
          ""
        ).toUpperCase();
        const indexA = PINNED_TOKEN_ORDER.indexOf(
          tokenA as (typeof PINNED_TOKEN_ORDER)[number],
        );
        const indexB = PINNED_TOKEN_ORDER.indexOf(
          tokenB as (typeof PINNED_TOKEN_ORDER)[number],
        );
        const rankA = indexA === -1 ? Number.POSITIVE_INFINITY : indexA;
        const rankB = indexB === -1 ? Number.POSITIVE_INFINITY : indexB;
        if (rankA !== rankB) return rankA - rankB;
        return a.symbol.localeCompare(b.symbol);
      })
    : undefined;

  return (
    <div className="flex flex-col flex-1 max-w-[1280px] w-full mx-auto gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] p-1">
          {(["SPOT", "FUTURES"] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                category === c
                  ? "bg-[var(--auth-color-primary)] text-[var(--app-color-foreground)]"
                  : "text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(76,148,255,0.24),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(0,194,120,0.14),transparent_35%)]" />
        <div className="relative flex items-center justify-between gap-6 px-6 py-7 md:px-10">
          <button
            type="button"
            className="text-2xl text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
          >
            ‹
          </button>
          <div className="flex-1">
            <p className="text-2xl font-semibold tracking-tight text-[var(--auth-text)] md:text-4xl">
              Earn <span className="text-green-400">4.70%</span> APY on your SOL
              collateral
            </p>
            <p className="mt-2 text-sm text-[var(--auth-text-muted)]">
              Lend SOL to earn staking yield and use it as collateral while
              trading.
            </p>
            <button
              type="button"
              className="mt-4 rounded-lg border border-[var(--auth-color-primary)]/40 bg-[var(--auth-color-primary)]/15 px-4 py-2 text-xs font-semibold text-[var(--auth-text)] hover:bg-[var(--auth-color-primary)]/25"
            >
              Lend SOL
            </button>
          </div>
          <div className="hidden size-28 rounded-full border border-[var(--auth-border)] bg-[var(--auth-surface-strong)] shadow-[0_0_80px_rgba(76,148,255,0.25)] md:block" />
          <button
            type="button"
            className="text-2xl text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
          >
            ›
          </button>
        </div>
        <div className="relative flex justify-center gap-1 pb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--auth-text-muted)]/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--auth-text-muted)]/40" />
          <span className="h-1.5 w-5 rounded-full bg-[var(--auth-text)]/90" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--auth-text-muted)]/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--auth-text-muted)]/40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {topSections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--auth-text)]">
                {section.title}
              </p>
              <p className="text-xs text-[var(--auth-text-muted)]">
                24h Change
              </p>
            </div>
            <div className="space-y-2">
              {section.rows.map((row) => (
                <div
                  key={row.symbol}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="w-[45%] text-[var(--auth-text)]">
                    {row.symbol}
                  </span>
                  <span className="w-[30%] text-right text-[var(--auth-text)]">
                    {row.price}
                  </span>
                  <span
                    className={`w-[25%] text-right font-medium ${
                      row.change >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {row.change >= 0 ? "+" : ""}
                    {row.change.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface)] overflow-hidden">
        <table className="w-full table-auto">
          <thead>
            <tr className="border-b border-[var(--auth-border)]">
              {[
                "Name",
                "Price",
                "24h Volume",
                category === "FUTURES" ? "Open Interest" : "Market Cap",
                "24h Change",
                "Last 7 Days",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-[var(--auth-text-muted)] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered?.map((m) => (
              <MarketRow
                key={m.symbol}
                market={m}
                category={category}
                openInterest={oiMap.get(m.symbol)}
                klinePoints={klineMap.get(m.symbol)}
              />
            ))}
          </tbody>
        </table>

        {ordered?.length === 0 && (
          <p className="py-10 text-center text-sm text-[var(--auth-text-muted)]">
            No markets found.
          </p>
        )}

        {!tickers && (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[80px] border-b border-[var(--auth-border)] animate-pulse bg-[var(--auth-surface-strong)]"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function MarketRow({
  market,
  category,
  openInterest,
  klinePoints,
}: {
  market: Ticker;
  category: "SPOT" | "FUTURES";
  openInterest?: string;
  klinePoints?: number[];
}) {
  const router = useRouter();
  const change = market.priceChangePercent
    ? Number(market.priceChangePercent)
    : null;
  const isPositive = change !== null && change >= 0;

  const thirdColValue =
    category === "FUTURES"
      ? openInterest && market.lastPrice
        ? formatUsd(String(Number(openInterest) * Number(market.lastPrice)))
        : "—"
      : "—";
  const baseToken = (
    market.baseCurrency ||
    market.symbol.split(/[_-]/)[0] ||
    ""
  ).toLowerCase();
  const tokenIconUrl = `https://backpack.exchange/coins/${baseToken}.png`;
  const marketLabel = market.symbol.replace("_", "-");

  return (
    <tr
      className="cursor-pointer border-b border-[var(--auth-border)] last:border-0 hover:bg-[var(--auth-surface-strong)] transition-colors"
      onClick={() => router.push(`/trade/${market.symbol}`)}
    >
      <td className="px-4 py-6">
        <div className="flex items-center gap-3">
          <img
            src={tokenIconUrl}
            alt={`${market.baseCurrency} logo`}
            className="size-9 rounded-full object-cover shrink-0"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback =
                target.nextElementSibling as HTMLDivElement | null;
              if (fallback) fallback.style.display = "grid";
            }}
          />
          <div
            style={{ display: "none" }}
            className="size-9 place-items-center rounded-full bg-[var(--auth-surface-strong)] text-[10px] font-bold text-[var(--auth-text)] shrink-0"
          >
            {market.baseCurrency.slice(0, 2)}
          </div>
          <span className="text-sm font-semibold text-[var(--auth-text)]">
            {marketLabel}
          </span>
        </div>
      </td>
      <td className="px-4 py-6">
        <span className="text-sm font-medium tabular-nums text-[var(--auth-text)]">
          {market.lastPrice
            ? `$${Number(market.lastPrice).toLocaleString()}`
            : "—"}
        </span>
      </td>
      <td className="px-4 py-6">
        <span className="text-sm tabular-nums text-[var(--auth-text-muted)]">
          {formatUsd(market.quoteVolume)}
        </span>
      </td>
      <td className="px-4 py-6">
        <span className="text-sm tabular-nums text-[var(--auth-text-muted)]">
          {thirdColValue}
        </span>
      </td>
      <td className="px-4 py-6">
        {change !== null ? (
          <span
            className={`text-sm font-medium tabular-nums ${
              isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {isPositive ? "+" : ""}
            {(change * 100).toFixed(2)}%
          </span>
        ) : (
          <span className="text-sm text-[var(--auth-text-muted)]">—</span>
        )}
      </td>
      <td className="px-4 py-6">
        <Sparkline points={klinePoints ?? []} />
      </td>
    </tr>
  );
}
