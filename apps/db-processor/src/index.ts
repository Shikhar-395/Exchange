import { DbMessage } from "@repo/common/dbMessages";
import { timeScaleClient } from "@repo/database/timescale";
import { createClient, RedisClientType } from "redis";
import { startCron } from "./cron";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await timeScaleClient.connect();
  console.log("connected to timescale");

  const redisClient: RedisClientType = createClient();
  await redisClient.connect();
  console.log("connected to redis");

  startCron();

  while (true) {
    const response = await redisClient.rPop("db_processor" as string);
    if (!response) {
      await sleep(100);
      continue;
    }

    const data: DbMessage = JSON.parse(response);

    if (data.type === "TRADE_ADDED") {
      const { price, quantity, quoteQuantity, timestamp, market } = data.data;
      await timeScaleClient.query(
        `INSERT INTO trades (time, market, price, quantity, quote_quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [new Date(timestamp), market, price, quantity, quoteQuantity],
      );
    }
  }
}

main();
