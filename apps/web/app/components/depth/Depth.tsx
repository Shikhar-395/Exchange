"use client";

import { useEffect, useState } from "react";
import { getDepth, getTicker, getTrades } from "../../utils/httpClient";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";
import { SignalingManager } from "../../utils/SignalingManager";

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
      (data: { price: string }) => {
        setPrice(data.price);
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
      <DepthHeader />
      <TableHeader />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
          {asks && <AskTable asks={asks} />}
        </div>
        {price && (
          <div className="my-1.5 border-y border-white/10 bg-[#0a1019] px-1.5 py-1 text-[34px] leading-none font-semibold tracking-tight text-[#00d8a0]">
            {formatPrice(price)}
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {bids && <BidTable bids={bids} />}
        </div>
      </div>
      <DepthFooter />
    </div>
  );
}

function DepthHeader() {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-white/10 bg-[#111a27] px-3 py-1 text-sm font-semibold text-white">
            Book
          </button>
          <button className="rounded-md px-3 py-1 text-sm font-semibold text-[#7f8ea4] hover:text-[#adc0d9]">
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

function TableHeader() {
  return (
    <div className="mb-1 flex justify-between border-b border-white/10 pb-1 text-[12px] font-semibold leading-tight">
      <div className="text-[#f5f7fa]">Price (USD)</div>
      <div className="text-[#93a1b7]">Size (ETH)</div>
      <div className="text-[#93a1b7]">Total (ETH)</div>
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

function formatPrice(price: string): string {
  const value = Number(price);
  if (Number.isNaN(value)) {
    return price;
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
