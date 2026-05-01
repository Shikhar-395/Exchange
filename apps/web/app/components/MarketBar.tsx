"use client";
import { useEffect, useState } from "react";
import { Ticker as TickerType } from "../utils/types";
import { getTicker } from "../utils/httpClient";
import { SignalingManager } from "../utils/SignalingManager";

const BRAND_LOGO_URL =
  "https://cdn.dribbble.com/userupload/45977907/file/6c9ac88b0b8e86d0cabf474a21f187e6.jpg?resize=1600x1200&vertical=center";

export const MarketBar = ({ market }: { market: string }) => {
  const [ticker, setTicker] = useState<TickerType | null>(null);

  useEffect(() => {
    getTicker(market)
      .then(setTicker)
      .catch(() => {});
    SignalingManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<TickerType>) =>
        setTicker((prev) => ({
          firstPrice: data?.firstPrice ?? prev?.firstPrice ?? "",
          high: data?.high ?? prev?.high ?? "",
          lastPrice: data?.lastPrice ?? prev?.lastPrice ?? "",
          low: data?.low ?? prev?.low ?? "",
          priceChange: data?.priceChange ?? prev?.priceChange ?? "",
          priceChangePercent:
            data?.priceChangePercent ?? prev?.priceChangePercent ?? "",
          quoteVolume: data?.quoteVolume ?? prev?.quoteVolume ?? "",
          symbol: data?.symbol ?? prev?.symbol ?? "",
          trades: data?.trades ?? prev?.trades ?? "",
          volume: data?.volume ?? prev?.volume ?? "",
        })),
      `TICKER-${market}`,
    );
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    });

    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "ticker",
        `TICKER-${market}`,
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      });
    };
  }, [market]);

  return (
    <div>
      <div className="flex items-center flex-row relative w-full overflow-hidden border-b border-base-border-light">
        <div className="flex items-center justify-between flex-row overflow-auto pr-4">
          <TickerHeader market={market} />
          <div className="flex items-center flex-row space-x-8 pl-4">
            <div className="flex flex-col h-full justify-center">
              <p className="font-medium tabular-nums text-md text-green-text">
                ${ticker?.lastPrice}
              </p>
              <p className="font-medium text-sm tabular-nums">
                ${ticker?.lastPrice}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-base-text-med-emphasis">
                24H Change
              </p>
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
              <p className="font-medium text-xs text-base-text-med-emphasis">
                24H High
              </p>
              <p className="text-sm font-medium tabular-nums leading-5">
                {ticker?.high}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-base-text-med-emphasis">
                24H Low
              </p>
              <p className="text-sm font-medium tabular-nums leading-5">
                {ticker?.low}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-base-text-med-emphasis">
                24H Volume
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums leading-5">
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
  return (
    <div className="flex h-[60px] shrink-0 space-x-4">
      <div className="flex flex-row relative ml-2 -mr-4">
        <img
          alt={`${market} Logo`}
          loading="lazy"
          className="z-10 rounded-full h-6 w-6 mt-4"
          src={BRAND_LOGO_URL}
        />
        <img
          alt="Quote Logo"
          loading="lazy"
          className="h-6 w-6 -ml-2 mt-4 rounded-full"
          src={BRAND_LOGO_URL}
        />
      </div>
      <button type="button">
        <div className="flex items-center justify-between flex-row cursor-pointer rounded-lg p-3 hover:opacity-80">
          <div className="flex items-center flex-row gap-2">
            <p className="font-medium text-sm">{market.replace("_", " / ")}</p>
          </div>
        </div>
      </button>
    </div>
  );
}
