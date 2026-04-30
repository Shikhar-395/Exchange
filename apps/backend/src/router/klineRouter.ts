import { Router, Response, Request } from "express";
import { timeScaleClient } from "../timescale";

export const klineRouter: Router = Router();

klineRouter.get("/", async (req: Request, res: Response) => {
  // input validation ?
  const { market, interval, startTime, endTime } = req.query;

  let query;
  // these query should be updated based on database processor
  switch (interval) {
    case "1m":
      query = `SELECT * FROM klines_1m WHERE bucket >= &1 AND bucket <= $2`;
      break;

    case "5m":
      query = `SELECT * FROM klines_1h WHERE bucket >= &1 AND bucket <= $2`;
      break;

    case "1h":
      query = `SELECT * FROM klines_1w WHERE bucket >= &1 AND bucket <= $2`;
      break;

    case "1w":
      query = `SELECT * FROM klines_1m WHERE bucket >= &1 AND bucket <= $2`;
      break;

    default:
      return res.status(400).json({
        message: "invalid inputs",
      });
  }
  try {
    //@ts-ignore
    const result = await timeScaleClient.query(query, [
      new Date((startTime * 1000) as string),
      new Date((endTime * 1000) as string),
    ]);
    /*INFO:
      return an array of object which looks like: 
    {
      close: x.close,
      end: x.bucket,
      high: x.high,
      low: x.low,
      open: x.open,
      quoteVolume: x.quoteVolume,
      start: x.start,
      trades: x.trades,
      volume: x.volume,
    }
      */
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "error occured while fetching kline data",
    });
  }
});
