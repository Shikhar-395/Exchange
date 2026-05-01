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
      break;
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

    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`depth@${market}`],
    });

    getDepth(market)
      .then((d) => {
        setBids(d.bids.reverse());
        setAsks(d.asks);
      })
      .catch(() => {});

    getTicker(market)
      .then((t) => setPrice(t.lastPrice))
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
        params: [`depth@${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "depth",
        `DEPTH-${market}`,
      );
    };
  }, [market]);

  return (
    <div>
      <TableHeader />
      {asks && <AskTable asks={asks} />}
      {price && <div className="text-sm py-1">{price}</div>}
      {bids && <BidTable bids={bids} />}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex justify-between text-xs">
      <div className="text-base-text-high-emphasis">Price</div>
      <div className="text-base-text-med-emphasis">Size</div>
      <div className="text-base-text-med-emphasis">Total</div>
    </div>
  );
}
