import { createClient, RedisClientType } from "redis";
import { DbMessage } from "./types";

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
        // put the data into timescale db
      }
    }
  }
}
main();
