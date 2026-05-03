import { timeScaleClient } from "../timescaleClient";
import { Router, Response, Request } from "express";

export const klineRouter: Router = Router();

const INTERVAL_BUCKETS: Record<string, string> = {
  "1m": "1 minute",
  "5m": "5 minutes",
  "15m": "15 minutes",
  "1h": "1 hour",
  "4h": "4 hours",
  "1d": "1 day",
  "1D": "1 day",
  "1w": "1 week",
  "1W": "1 week",
};

klineRouter.get("/", async (req: Request, res: Response) => {
  const { symbol, interval, startTime, endTime } = req.query;

  if (!symbol) {
    return res.status(400).json({ message: "symbol is required" });
  }

  const bucket = INTERVAL_BUCKETS[String(interval)];
  if (!bucket) {
    return res.status(400).json({
      message: "invalid interval",
      supported: Object.keys(INTERVAL_BUCKETS),
    });
  }

  const start = new Date(Number(startTime) * 1000);
  const end = new Date(Number(endTime) * 1000);

  try {
    const result = await timeScaleClient.query(
      `
      SELECT
        time_bucket($1::interval, time) AS bucket,
        first(price, time)  AS open,
        max(price)          AS high,
        min(price)          AS low,
        last(price, time)   AS close,
        sum(quantity)       AS volume,
        sum(quote_quantity) AS quote_volume,
        count(*)            AS trades
      FROM trades
      WHERE market = $2 AND time >= $3 AND time <= $4
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      [bucket, symbol, start, end],
    );

    res.json(
      result.rows.map((x: any) => ({
        close: String(x.close),
        end: x.bucket,
        high: String(x.high),
        low: String(x.low),
        open: String(x.open),
        quoteVolume: String(x.quote_volume),
        start: x.bucket,
        trades: Number(x.trades),
        volume: String(x.volume),
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "error fetching kline data" });
  }
});
