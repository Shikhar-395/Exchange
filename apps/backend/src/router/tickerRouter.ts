import { Router, Request, Response } from "express";
import axios from "axios";

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
    const { data } = await axios.get(BACKPACK_TICKERS_URL, {
      headers: { accept: "application/json" },
    });
    res.json((data as Record<string, string>[]).map(enrichTicker));
  } catch (err) {
    console.error("failed to fetch tickers from backpack:", err);
    res.status(502).json({ message: "upstream error" });
  }
});
