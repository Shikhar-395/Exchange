"use client";
import { useEffect, useRef } from "react";
import { ChartManager } from "../utils/ChartManager";
import { getKlines } from "../utils/httpClient";
import { KLine } from "../utils/types";
import { useTheme } from "next-themes";

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const init = async () => {
      let klineData: KLine[] = [];
      try {
        klineData = await getKlines(
          market,
          "1h",
          Math.floor((new Date().getTime() - 1000 * 60 * 60 * 24 * 7) / 1000),
          Math.floor(new Date().getTime() / 1000),
        );
      } catch (e) {}

      if (chartRef.current) {
        if (chartManagerRef.current) chartManagerRef.current.destroy();
        const isDark = resolvedTheme !== "light";
        const chartManager = new ChartManager(
          chartRef.current,
          [
            ...klineData.map((x) => ({
              close: parseFloat(x.close),
              high: parseFloat(x.high),
              low: parseFloat(x.low),
              open: parseFloat(x.open),
              timestamp: new Date(x.end).getTime(),
            })),
          ].sort((x, y) => (x.timestamp < y.timestamp ? -1 : 1)),
          {
            background: isDark ? "#0e0f14" : "#f6f8fc",
            color: isDark ? "#f4f4f6" : "#0d1526",
          },
        );
        chartManagerRef.current = chartManager;
      }
    };
    init();
  }, [market, resolvedTheme]);

  return (
    <div
      ref={chartRef}
      style={{ height: "520px", width: "100%", marginTop: 4 }}
    />
  );
}
