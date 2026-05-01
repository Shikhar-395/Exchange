import { DbMessage } from "@repo/common/dbMessages";
import { timeScaleClient } from "@repo/database/timescale";
import { createClient, RedisClientType } from "redis";

async function main() {
  const redisClient: RedisClientType = createClient();
  await redisClient.connect();
  console.log("conected to redis");

  while (true) {
    const response = await redisClient.rPop("db_processor" as string);
    if (!response) {
      continue;
    } else {
      const data: DbMessage = JSON.parse(response);
      if (data.type == "TRADE_ADDED") {
        console.log(data);
        const price = data.data.price;
        const timestamp = new Date(data.data.timestamp);
        const query = "INSERT INTO tata_prices (time, price) VALUES ($1, $2)";
        const values = [timestamp, price];
        await timeScaleClient.query(query, values);
        // put the data into timescale db
      }
    }
  }
}
main();
