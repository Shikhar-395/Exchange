import { Router, Request, Response } from "express";
import axios from "axios";
import { prisma } from "@repo/database/client";

export const tickersRouter: Router = Router();

const BACKPACK_TICKERS_URL = "https://api.backpack.exchange/api/v1/tickers";

function enrichTicker(t: Record<string, string>) {
  const parts = t.symbol.split("_");
  const isPerp = parts[parts.length - 1] === "PERP";
  const baseCurrency = parts[0] ?? "";
  const quoteCurrency = isPerp ? (parts[1] ?? "") : (parts[1] ?? "");
  const category = isPerp ? "FUTURES" : "SPOT";
  const name = isPerp
    ? `${baseCurrency} Perpetual`
    : `${baseCurrency}/${quoteCurrency}`;
  return { ...t, baseCurrency, quoteCurrency, category, name };
}

tickersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const [{ data }, allowed] = await Promise.all([
      axios.get(BACKPACK_TICKERS_URL, {
        headers: { accept: "application/json" },
      }),
      prisma.market.findMany({ select: { symbol: true } }),
    ]);
    const upstreamMap = new Map<string, Record<string, string>>(
      (data as Record<string, string>[]).map((t) => [t.symbol, t]),
    );

    const counterpart = (sym: string) =>
      sym.endsWith("_PERP") ? sym.slice(0, -"_PERP".length) : `${sym}_PERP`;

    const result = allowed.map(({ symbol }) => {
      const direct = upstreamMap.get(symbol);
      if (direct) return enrichTicker(direct);
      const fallback = upstreamMap.get(counterpart(symbol));
      const base: Record<string, string> = fallback
        ? { ...fallback, symbol }
        : { symbol, lastPrice: "" };
      return enrichTicker(base);
    });
    res.json(result);
  } catch (err) {
    console.error("failed to fetch tickers from backpack:", err);
    res.status(502).json({ message: "upstream error" });
  }
});
