import { Router, Request, Response } from "express";
import axios from "axios";
import { prisma } from "@repo/database/client";

export const marketDataKlinesRouter: Router = Router();

const BACKPACK_KLINES_URL =
  "https://api.backpack.exchange/wapi/v1/marketDataKlines";

marketDataKlinesRouter.get("/", async (req: Request, res: Response) => {
  const { interval, startTime, endTime, symbol } = req.query;
  try {
    const [{ data }, allowed] = await Promise.all([
      axios.get(BACKPACK_KLINES_URL, {
        headers: { accept: "application/json" },
        params: { interval, startTime, endTime, ...(symbol ? { symbol } : {}) },
      }),
      prisma.market.findMany({ select: { symbol: true } }),
    ]);
    const allowedSet = new Set(allowed.map((m) => m.symbol));
    const filtered = (data as Array<{ symbol: string }>).filter((d) =>
      allowedSet.has(d.symbol),
    );
    res.json(filtered);
  } catch (err) {
    console.error("failed to fetch klines from backpack:", err);
    res.status(502).json({ message: "upstream error" });
  }
});
