"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Ticker } from "../utils/types";
import { getMarketDataKlines, getTickers } from "../utils/httpClient";

function formatUsd(value: string | null): string {
  if (!value) return "—";
  const num = Number(value);
  if (num >= 1_000_000) return `$${Math.floor(num / 100_000) / 10}M`;
  if (num >= 1_000) return `$${Math.floor(num / 100) / 10}K`;
  return `$${num.toFixed(2)}`;
}

function Sparkline({ points }: { points: number[] }) {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined || points.length < 2)
    return <span className="text-sm text-[var(--auth-text-muted)]">—</span>;
  const weekUp = last >= first;
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
  "TON",
] as const;

const topSections = [
  {
    title: "New",
    rows: [
      { symbol: "TON_USDC", price: "$5.78", change: -1.04 },
      { symbol: "LINK_USDC", price: "$23.40", change: 1.1 },
      { symbol: "AVAX_USDC", price: "$36.20", change: 6.51 },
      { symbol: "ADA_USDC", price: "$0.62", change: -3.64 },
      { symbol: "DOGE_USDC", price: "$0.18", change: 8.46 },
    ],
  },
  {
    title: "Top Movers",
    rows: [
      { symbol: "DOGE_USDC", price: "$0.18", change: 8.46 },
      { symbol: "AVAX_USDC", price: "$36.20", change: 6.51 },
      { symbol: "ADA_USDC", price: "$0.62", change: -3.64 },
      { symbol: "LINK_USDC", price: "$23.40", change: 1.1 },
      { symbol: "TON_USDC", price: "$5.78", change: -1.04 },
    ],
  },
  {
    title: "Popular",
    rows: [
      { symbol: "BTC_USDC", price: "$77,264.60", change: 1.53 },
      { symbol: "ETH_USDC", price: "$2,281.99", change: 0.71 },
      { symbol: "SOL_USDC", price: "$83.90", change: 0.82 },
      { symbol: "XRP_USDC", price: "$2.34", change: 1.2 },
      { symbol: "BNB_USDC", price: "$612.40", change: 0.45 },
    ],
  },
];

export const Markets = ({
  showTopCards = true,
  showTable = true,
}: {
  showTopCards?: boolean;
  showTable?: boolean;
}) => {
  const router = useRouter();
  const [tickers, setTickers] = useState<Ticker[]>();
  const [marketDataError, setMarketDataError] = useState(false);
  const [klineMap, setKlineMap] = useState<Map<string, number[]>>(new Map());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredRowSymbol, setHoveredRowSymbol] = useState<string | null>(null);

  useEffect(() => {
    getTickers()
      .then((data) => {
        setMarketDataError(false);
        setTickers(data);
      })
      .catch(() => {
        setMarketDataError(true);
        setTickers([]);
      });

    getMarketDataKlines()
      .then((arr) => {
        const map = new Map(
          arr.map((d) => [d.symbol, d.data.map((p) => Number(p.close))]),
        );
        setKlineMap(map);
      })
      .catch(() => {});
  }, []);

  const ordered = tickers
    ? [...tickers].sort((a, b) => {
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
    <div
      className={`flex flex-col max-w-[1280px] w-full mx-auto gap-4 ${
        showTable ? "flex-1 justify-start" : "justify-center my-auto"
      }`}
    >
      {showTopCards && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {topSections.map((section, idx) => {
            let subtitle = "New token listings";
            if (section.title === "Top Movers") {
              subtitle = "Top gainers last 24h";
            } else if (section.title === "Popular") {
              subtitle = "Highest trading volume";
            }

            const isCardBlurred = hoveredIndex !== null && hoveredIndex !== idx;

            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                whileHover={
                  !isCardBlurred ? { y: -5, scale: 1.012 } : undefined
                }
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`rounded-[24px] border border-[var(--auth-border)] dark:border-white/[0.06] bg-[var(--auth-surface)] p-3.5 pb-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:border-black/10 dark:hover:border-white/12 ease-out ${
                  isCardBlurred ? "blur-[1px] scale-[0.98] opacity-50" : ""
                }`}
              >
                {/* Centered Header outside the inner card as shown in inspiration image */}
                <div className="flex flex-col items-center justify-center pt-1.5 pb-3.5 gap-0.5">
                  <span className="text-xs font-extrabold text-[var(--auth-text)] tracking-wider uppercase">
                    {section.title}
                  </span>
                  <span className="text-[9px] font-bold text-[var(--auth-text-muted)] tracking-widest uppercase opacity-85">
                    {subtitle}
                  </span>
                </div>

                {/* Inner card containing the ticker rows (nested border & darker background) */}
                <div className="rounded-[16px] border border-black/[0.03] dark:border-white/[0.06] bg-black/10 dark:bg-black/35 shadow-inner p-1.5 backdrop-blur-md">
                  {/* Header row in inner card */}
                  <div className="flex items-center justify-between px-3 py-1.5 text-[9px] font-extrabold text-[var(--auth-text-muted)] uppercase tracking-wider border-b border-black/[0.03] dark:border-white/[0.04] mb-1">
                    <span className="w-[45%] text-left">Asset</span>
                    <span className="w-[30%] text-right">Price</span>
                    <span className="w-[25%] text-right">24h Chg</span>
                  </div>

                  <div className="space-y-0.5">
                    {section.rows.map((row) => {
                      const baseSymbol = row.symbol.split("_")[0] || "";
                      const iconUrl = `https://backpack.exchange/coins/${baseSymbol.toLowerCase()}.png`;
                      return (
                        <div
                          key={row.symbol}
                          onClick={() => router.push(`/trade/${row.symbol}`)}
                          className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.05] dark:hover:bg-white/[0.05] hover:bg-black/[0.03] transition-all duration-200 cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 w-[45%]">
                            <img
                              src={iconUrl}
                              alt={`${baseSymbol} logo`}
                              className="size-[22px] rounded-full object-cover shrink-0 shadow-sm bg-white/5 transition-transform duration-200 group-hover:scale-110"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <span className="font-semibold text-xs text-[var(--auth-text)] tracking-tight group-hover:text-[var(--auth-color-primary)] transition-colors">
                              {row.symbol}
                            </span>
                          </div>
                          <span className="w-[30%] text-right font-medium text-xs tabular-nums text-[var(--auth-text)]">
                            {row.price}
                          </span>
                          <span
                            className={`w-[25%] text-right font-bold text-xs tabular-nums transition-transform duration-200 group-hover:scale-105 ${
                              row.change >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {row.change >= 0 ? "+" : ""}
                            {row.change.toFixed(2)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {showTable && (
        <motion.div
          whileHover={{ y: -4, scale: 1.002 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-[24px] border border-[var(--auth-border)] dark:border-white/[0.06] bg-[var(--auth-surface)] p-3.5 pb-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:border-black/10 dark:hover:border-white/12 ease-out"
        >
          {/* Table Centered/Styled Header */}
          <div className="flex items-center justify-between px-3.5 pt-1.5 pb-3.5">
            <h3 className="text-sm font-extrabold text-[var(--auth-text)] tracking-wider uppercase">
              Spot Markets
            </h3>
            <span className="text-[9px] font-bold text-[var(--auth-text-muted)] tracking-widest uppercase opacity-85">
              Live Trading Pairs
            </span>
          </div>

          {/* Inner card nested border & darker background */}
          <div className="rounded-[16px] border border-black/[0.03] dark:border-white/[0.06] bg-black/10 dark:bg-black/35 shadow-inner backdrop-blur-md overflow-hidden">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-black/[0.05] dark:border-white/[0.05] bg-black/[0.02] dark:bg-black/[0.1]">
                  {[
                    "Name",
                    "Price",
                    "24h Volume",
                    "Market Cap",
                    "24h Change",
                    "Last 7 Days",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3.5 text-left text-[10px] font-bold text-[var(--auth-text-muted)] uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordered?.map((m, index) => (
                  <MarketRow
                    key={m.symbol}
                    index={index}
                    market={m}
                    klinePoints={klineMap.get(m.symbol)}
                    isBlurred={
                      hoveredRowSymbol !== null && hoveredRowSymbol !== m.symbol
                    }
                    onMouseEnter={() => setHoveredRowSymbol(m.symbol)}
                    onMouseLeave={() => setHoveredRowSymbol(null)}
                  />
                ))}
              </tbody>
            </table>

            {marketDataError && (
              <p className="py-10 text-center text-sm text-[var(--auth-text-muted)]">
                Market data unavailable.
              </p>
            )}

            {!marketDataError && ordered?.length === 0 && (
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
        </motion.div>
      )}
    </div>
  );
};

function MarketRow({
  market,
  index,
  klinePoints,
  isBlurred,
  onMouseEnter,
  onMouseLeave,
}: {
  market: Ticker;
  index: number;
  klinePoints?: number[];
  isBlurred: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const router = useRouter();
  const change = market.priceChangePercent
    ? Number(market.priceChangePercent)
    : null;
  const isPositive = change !== null && change >= 0;

  const thirdColValue = "—";
  const baseToken = (
    market.baseCurrency ||
    market.symbol.split(/[_-]/)[0] ||
    ""
  ).toLowerCase();
  const tokenIconUrl = `https://backpack.exchange/coins/${baseToken}.png`;
  const marketLabel = market.symbol.replace("_", "-");

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.035 }}
      className={`cursor-pointer border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-all duration-300 ease-out ${
        isBlurred ? "blur-[0.5px] opacity-40 scale-[0.995]" : ""
      }`}
      onClick={() => router.push(`/trade/${market.symbol}`)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
    </motion.tr>
  );
}
