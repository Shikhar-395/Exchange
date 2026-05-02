import { timeScaleClient } from "@repo/database/timescale";
import { Router, Response, Request } from "express";

export const klineRouter: Router = Router();

klineRouter.get("/", async (req: Request, res: Response) => {
  const { symbol, interval, startTime, endTime } = req.query;

  if (!symbol) {
    return res.status(400).json({ message: "symbol is required" });
  }

  let table: string;
  switch (interval) {
    case "1m":
      table = "klines_1m";
      break;
    case "1h":
      table = "klines_1h";
      break;
    case "1w":
      table = "klines_1w";
      break;
    default:
      return res.status(400).json({ message: "invalid interval" });
  }

  try {
    const result = await timeScaleClient.query(
      `SELECT * FROM ${table} WHERE market = $1 AND bucket >= $2 AND bucket <= $3 ORDER BY bucket ASC`,
      [
        symbol,
        new Date(Number(startTime) * 1000),
        new Date(Number(endTime) * 1000),
      ],
    );
    res.json(
      result.rows.map((x: any) => ({
        close: x.close,
        end: x.bucket,
        high: x.high,
        low: x.low,
        open: x.open,
        quoteVolume: x.quote_volume,
        start: x.start,
        trades: x.trades,
        volume: x.volume,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "error fetching kline data" });
  }
});
