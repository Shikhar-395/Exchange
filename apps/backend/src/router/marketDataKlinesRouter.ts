import { Router, Request, Response } from "express";
import axios from "axios";

export const marketDataKlinesRouter: Router = Router();

const BACKPACK_KLINES_URL =
  "https://api.backpack.exchange/wapi/v1/marketDataKlines";

marketDataKlinesRouter.get("/", async (req: Request, res: Response) => {
  const { interval, startTime, endTime, symbol } = req.query;
  try {
    const { data } = await axios.get(BACKPACK_KLINES_URL, {
      headers: { accept: "application/json" },
      params: { interval, startTime, endTime, ...(symbol ? { symbol } : {}) },
    });
    res.json(data);
  } catch (err) {
    console.error("failed to fetch klines from backpack:", err);
    res.status(502).json({ message: "upstream error" });
  }
});
