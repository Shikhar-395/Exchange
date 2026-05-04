import { Router, Request, Response } from "express";
import axios from "axios";
import { prisma } from "@repo/database/client";

export const openInterestRouter: Router = Router();

const BACKPACK_OI_URL = "https://api.backpack.exchange/api/v1/openInterest";

openInterestRouter.get("/", async (req: Request, res: Response) => {
  try {
    const [{ data }, allowed] = await Promise.all([
      axios.get(BACKPACK_OI_URL, {
        headers: { accept: "application/json" },
      }),
      prisma.market.findMany({ select: { symbol: true } }),
    ]);
    const allowedSet = new Set(allowed.map((m) => m.symbol));
    const filtered = (data as Array<{ symbol: string }>).filter((d) =>
      allowedSet.has(d.symbol),
    );
    res.json(filtered);
  } catch (err) {
    console.error("failed to fetch open interest from backpack:", err);
    res.status(502).json({ message: "upstream error" });
  }
});
