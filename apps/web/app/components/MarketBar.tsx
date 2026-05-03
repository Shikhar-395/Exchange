"use client";
import { useEffect, useState } from "react";
import { Ticker as TickerType } from "../utils/types";
import { getTicker } from "../utils/httpClient";
import { SignalingManager } from "../utils/SignalingManager";

export const MarketBar = ({ market }: { market: string }) => {
  const [ticker, setTicker] = useState<TickerType | null>(null);

  useEffect(() => {
    getTicker(market)
      .then(setTicker)
      .catch(() => {});
    SignalingManager.getInstance().registerCallback(
      "trade",
      (data: { price: string }) =>
        setTicker((prev) =>
          prev ? { ...prev, lastPrice: data.price ?? prev.lastPrice } : prev,
        ),
      `TRADE-${market}`,
    );
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`trade@${market}`],
    });

    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "trade",
        `TRADE-${market}`,
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`trade@${market}`],
      });
    };
  }, [market]);

  return (
    <div className="border-b border-[#1a2232] bg-[#090d14]">
      <div className="relative flex w-full items-center overflow-hidden">
        <div className="flex items-center justify-between overflow-auto pr-4">
          <TickerHeader market={market} />
          <div className="flex items-center space-x-8 pl-4">
            <div className="flex flex-col h-full justify-center">
              <p className="text-md font-medium tabular-nums text-green-text">
                ${ticker?.lastPrice}
              </p>
              <p className="text-sm font-medium tabular-nums text-[#dce4ef]">
                ${ticker?.lastPrice}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[#7f90a9]">24H Change</p>
              <p
                className={`text-sm font-medium tabular-nums leading-5 ${
                  Number(ticker?.priceChange) > 0
                    ? "text-green-text"
                    : "text-red-text"
                }`}
              >
                {Number(ticker?.priceChange) > 0 ? "+" : ""}{" "}
                {ticker?.priceChange}{" "}
                {Number(ticker?.priceChangePercent)?.toFixed(2)}%
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[#7f90a9]">24H High</p>
              <p className="text-sm font-medium tabular-nums leading-5 text-[#dce4ef]">
                {ticker?.high}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[#7f90a9]">24H Low</p>
              <p className="text-sm font-medium tabular-nums leading-5 text-[#dce4ef]">
                {ticker?.low}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[#7f90a9]">24H Volume</p>
              <p className="mt-1 text-sm font-medium tabular-nums leading-5 text-[#dce4ef]">
                {ticker?.volume}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function TickerHeader({ market }: { market: string }) {
  const [baseRaw, quoteRaw = "USDC"] = market.split(/[_/]/);
  const base = (baseRaw || "").replace(/-?PERP$/i, "");
  const quote = (quoteRaw || "USDC").replace(/-?PERP$/i, "");
  const isPerp = /PERP/i.test(market);
  const baseIconUrl = `https://backpack.exchange/coins/${base.toLowerCase()}.png`;

  return (
    <div className="flex h-[58px] shrink-0 items-center space-x-1.5">
      <div className="relative ml-2">
        <img
          alt={`${base} logo`}
          loading="lazy"
          className="h-6 w-6 rounded-full"
          src={baseIconUrl}
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const fallback = target.nextElementSibling as HTMLDivElement | null;
            if (fallback) fallback.style.display = "grid";
          }}
        />
        <div
          style={{ display: "none" }}
          className="h-6 w-6 place-items-center rounded-full bg-[#1a2232] text-[9px] font-bold text-[#dce4ef]"
        >
          {base.slice(0, 2).toUpperCase()}
        </div>
      </div>
      <button type="button">
        <div className="flex cursor-pointer flex-row items-center justify-between rounded-lg px-2 py-1 hover:opacity-90">
          <div className="flex items-center flex-row gap-2">
            <p className="text-sm font-medium text-[#dce4ef]">
              {base.toUpperCase()} / {quote.toUpperCase()}
            </p>
            {isPerp && (
              <span className="rounded bg-[#182334] px-1.5 py-0.5 text-[10px] font-semibold text-[#8ea0ba]">
                PERP
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
