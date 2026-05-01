import { Router, Request, Response } from "express";
import { prisma } from "@repo/database/client";

export const tickersRouter: Router = Router();

tickersRouter.get("/", async (req: Request, res: Response) => {
  const markets = await prisma.market.findMany({
    where: { isActive: true },
    select: {
      symbol: true,
      name: true,
      baseCurrency: true,
      quoteCurrency: true,
      category: true,
    },
    orderBy: { symbol: "asc" },
  });

  const tickers = markets.map((m) => ({
    symbol: m.symbol,
    name: m.name,
    baseCurrency: m.baseCurrency,
    quoteCurrency: m.quoteCurrency,
    category: m.category,
    lastPrice: null,
    firstPrice: null,
    high: null,
    low: null,
    volume: null,
    quoteVolume: null,
    trades: null,
    priceChange: null,
    priceChangePercent: null,
  }));

  res.json(tickers);
});
