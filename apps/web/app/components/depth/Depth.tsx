"use client";

import { useEffect, useState, useRef } from "react";
import { getDepth, getTicker, getTrades } from "../../utils/httpClient";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";
import { SignalingManager } from "../../utils/SignalingManager";
import { Trade } from "../../utils/types";
import { formatAmount, formatPrice, splitMarket } from "./format";

function applyUpdates(
  original: [string, string][] | undefined,
  updates: [string, string][],
  ascending: boolean,
): [string, string][] {
  const next: [string, string][] = (original ?? []).map(
    (row) => [...row] as [string, string],
  );

  for (let i = next.length - 1; i >= 0; i--) {
    const row = next[i]!;
    for (const upd of updates) {
      if (row[0] === upd[0]) {
        row[1] = upd[1];
        if (Number(row[1]) === 0) next.splice(i, 1);
        break;
      }
    }
  }

  for (const upd of updates) {
    if (Number(upd[1]) !== 0 && !next.some((r) => r[0] === upd[0])) {
      next.push([upd[0], upd[1]]);
    }
  }

  next.sort((x, y) =>
    ascending ? Number(x[0]) - Number(y[0]) : Number(y[0]) - Number(x[0]),
  );
  return next;
}

export function Depth({ market }: { market: string }) {
  const [bids, setBids] = useState<[string, string][]>();
  const [asks, setAsks] = useState<[string, string][]>();
  const [price, setPrice] = useState<string>();
  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");
  const [trades, setTrades] = useState<Trade[]>([]);
  const { base, quote } = splitMarket(market);

  // Sizing ref & state
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxRows, setMaxRows] = useState(6);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        // Price banner height is ~36px
        // rowHeight is 24px (20px row + 4px vertical margin)
        const computedRows = Math.floor((height - 36) / (2 * 24));
        const validRows = Math.max(3, Math.min(15, computedRows));
        setMaxRows(validRows);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    SignalingManager.getInstance().registerCallback(
      "depth",
      (data: { bids: [string, string][]; asks: [string, string][] }) => {
        setBids((orig) => applyUpdates(orig, data.bids, false));
        setAsks((orig) => applyUpdates(orig, data.asks, true));
      },
      `DEPTH-${market}`,
    );

    SignalingManager.getInstance().registerCallback(
      "trade",
      (data: {
        price: string;
        quantity: string;
        tradeId: number;
        isBuyerMaker: boolean;
        symbol: string;
      }) => {
        setPrice(data.price);
        setTrades((prev) => {
          const newTrade: Trade = {
            id: data.tradeId,
            isBuyerMaker: data.isBuyerMaker,
            price: data.price,
            quantity: data.quantity,
            quoteQuantity: String(Number(data.price) * Number(data.quantity)),
            timestamp: Date.now(),
          };
          // Filter duplicates and keep rolling window of 50
          const next = [newTrade, ...prev.filter((t) => t.id !== newTrade.id)];
          return next.slice(0, 50);
        });
      },
      `DEPTH-TRADE-${market}`,
    );

    SignalingManager.getInstance().registerCallback(
      "ticker",
      (data: { lastPrice?: string }) => {
        if (data.lastPrice) setPrice(data.lastPrice);
      },
      `DEPTH-TICKER-${market}`,
    );

    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`depth@${market}`, `trade@${market}`, `ticker@${market}`],
    });

    getDepth(market)
      .then((d) => {
        setBids(d.bids.reverse());
        setAsks(d.asks);
      })
      .catch(() => {});

    getTicker(market)
      .then((t) => setPrice(t.lastPrice ?? undefined))
      .catch(() => {});

    getTrades(market)
      .then((t) => {
        setTrades(t.slice(0, 50));
        const first = t[0];
        if (first) setPrice(first.price);
      })
      .catch(() => {});

    return () => {
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`depth@${market}`, `trade@${market}`, `ticker@${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "depth",
        `DEPTH-${market}`,
      );
      SignalingManager.getInstance().deRegisterCallback(
        "trade",
        `DEPTH-TRADE-${market}`,
      );
      SignalingManager.getInstance().deRegisterCallback(
        "ticker",
        `DEPTH-TICKER-${market}`,
      );
    };
  }, [market]);

  return (
    <div className="flex h-full flex-col bg-[#090d14] px-3 py-2 text-[#d7deea]">
      <DepthHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === "book" ? (
        <>
          <TableHeader base={base} quote={quote} />
          <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
              {asks && <AskTable asks={asks} maxRows={maxRows} />}
            </div>
            {price && (
              <div className="my-1 border-y border-white/10 bg-[#0a1019] px-1.5 py-0.5 text-[24px] leading-none font-semibold tracking-tight text-[#00d8a0]">
                {formatPrice(price)}
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {bids && <BidTable bids={bids} maxRows={maxRows} />}
            </div>
          </div>
          <DepthFooter />
        </>
      ) : (
        <TradesTable trades={trades} base={base} quote={quote} />
      )}
    </div>
  );
}

function DepthHeader({
  activeTab,
  setActiveTab,
}: {
  activeTab: "book" | "trades";
  setActiveTab: (tab: "book" | "trades") => void;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("book")}
            className={`rounded-md px-3 py-1 text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === "book"
                ? "border border-white/10 bg-[#111a27] text-white"
                : "text-[#7f8ea4] hover:text-[#adc0d9]"
            }`}
          >
            Book
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`rounded-md px-3 py-1 text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === "trades"
                ? "border border-white/10 bg-[#111a27] text-white"
                : "text-[#7f8ea4] hover:text-[#adc0d9]"
            }`}
          >
            Trades
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="h-2.5 w-5 rounded-sm bg-[#0e3f33]" />
        <span className="h-2.5 w-5 rounded-sm bg-[#3f1f25]" />
        <span className="h-2.5 w-5 rounded-sm bg-[#0e3f33]" />
        <span className="h-2.5 w-5 rounded-sm bg-[#3f1f25]" />
      </div>
    </div>
  );
}

function TableHeader({ base, quote }: { base: string; quote: string }) {
  return (
    <div className="mb-1 flex justify-between border-b border-white/10 pb-1 text-[12px] font-semibold leading-tight">
      <div className="text-[#f5f7fa]">Price ({quote})</div>
      <div className="text-[#93a1b7]">Size ({base})</div>
      <div className="text-[#93a1b7]">Total ({base})</div>
    </div>
  );
}

function DepthFooter() {
  return (
    <div className="mt-2 flex h-7 overflow-hidden rounded-sm border border-white/10 text-base font-semibold leading-none">
      <div className="flex w-1/3 items-center justify-start bg-[#103429] px-2 text-[#00d8a0]">
        33%
      </div>
      <div className="w-0 flex-1 border-t-[22px] border-r-[12px] border-t-transparent border-r-[#3e2026]" />
      <div className="flex w-1/3 items-center justify-end bg-[#35171d] px-2 text-[#e05b63]">
        67%
      </div>
    </div>
  );
}

function TradesTable({
  trades,
  base,
  quote,
}: {
  trades: Trade[];
  base: string;
  quote: string;
}) {
  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      {/* Header */}
      <div className="mb-1 flex justify-between border-b border-white/10 pb-1 text-[12px] font-semibold leading-tight px-1.5">
        <div className="text-[#f5f7fa]">Price ({quote})</div>
        <div className="text-[#93a1b7] text-right pr-4">Size ({base})</div>
        <div className="text-[#93a1b7] text-right">Time</div>
      </div>
      {/* Scrollable list of trades */}
      <div className="flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
        {trades.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[#7f8ea4] py-8">
            No recent trades
          </div>
        ) : (
          trades.map((trade) => {
            const date = new Date(trade.timestamp);
            const timeString = isNaN(date.getTime())
              ? "--:--:--"
              : date.toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
            const isSell = trade.isBuyerMaker;
            return (
              <div
                key={trade.id}
                className="relative my-[2px] flex h-[20px] w-full items-center px-1.5 text-[13px] font-semibold leading-none tracking-tight hover:bg-white/[0.02] rounded-[2px]"
              >
                <div className={isSell ? "text-[#e35d66]" : "text-[#00d8a0]"}>
                  {formatPrice(trade.price)}
                </div>
                <div className="flex-1 text-right text-[#e3e9f3] pr-4 tabular-nums">
                  {formatAmount(trade.quantity)}
                </div>
                <div className="text-[#7f8ea4] text-[11px] font-normal w-[65px] text-right tabular-nums">
                  {timeString}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
