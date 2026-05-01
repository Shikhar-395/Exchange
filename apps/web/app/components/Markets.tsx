"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticker } from "../utils/types";
import { getTickers } from "../utils/httpClient";

export const Markets = () => {
  const [tickers, setTickers] = useState<Ticker[]>();

  useEffect(() => {
    getTickers()
      .then(setTickers)
      .catch(() => setTickers([]));
  }, []);

  return (
    <div className="flex flex-col flex-1 max-w-[1280px] w-full">
      <div className="flex flex-col min-w-[700px] flex-1 w-full">
        <div className="flex flex-col w-full rounded-lg bg-base-background-l1 px-5 py-3">
          <table className="w-full table-auto">
            <MarketHeader />
            <tbody>
              {tickers?.map((m) => (
                <MarketRow key={m.symbol} market={m} />
              ))}
            </tbody>
          </table>
          {tickers && tickers.length === 0 && (
            <p className="py-6 text-center text-sm text-base-text-med-emphasis">
              No markets available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

function MarketRow({ market }: { market: Ticker }) {
  const router = useRouter();
  return (
    <tr
      className="cursor-pointer border-t border-base-border-light hover:bg-white/5 w-full"
      onClick={() => router.push(`/trade/${market.symbol}`)}
    >
      <td className="px-1 py-3">
        <div className="flex shrink">
          <div className="flex items-center">
            <div
              className="relative flex-none overflow-hidden rounded-full border border-base-border-med"
              style={{ width: "40px", height: "40px" }}
            >
              <img
                alt={market.symbol}
                src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVvBqZC_Q1TSYObZaMvK0DRFeHZDUtVMh08Q&s"
                loading="lazy"
                width="40"
                height="40"
              />
            </div>
            <div className="ml-4 flex flex-col">
              <p className="whitespace-nowrap text-base font-medium text-base-text-high-emphasis">
                {market.symbol}
              </p>
              <p className="text-left text-xs leading-5 text-base-text-med-emphasis">
                {market.symbol}
              </p>
            </div>
          </div>
        </div>
      </td>
      <td className="px-1 py-3">
        <p className="text-base font-medium tabular-nums">{market.lastPrice}</p>
      </td>
      <td className="px-1 py-3">
        <p className="text-base font-medium tabular-nums">{market.high}</p>
      </td>
      <td className="px-1 py-3">
        <p className="text-base font-medium tabular-nums">{market.volume}</p>
      </td>
      <td className="px-1 py-3">
        <p className="text-base font-medium tabular-nums text-green-text">
          {Number(market.priceChangePercent)?.toFixed(3)} %
        </p>
      </td>
    </tr>
  );
}

function MarketHeader() {
  const headers = ["Name", "Price", "24h High", "24h Volume", "24h Change"];
  return (
    <thead>
      <tr>
        {headers.map((h) => (
          <th
            key={h}
            className="px-2 py-3 text-left text-sm font-normal text-base-text-med-emphasis"
          >
            <div className="flex items-center gap-1 cursor-pointer select-none">
              {h}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}
