import { createClient } from "redis";
import { Engine } from "./trade/engine";

async function main() {
  const redisClient = createClient();
  await redisClient.connect();
  const engine = new Engine();

  while (true) {
    const response = await redisClient.rPop("messages" as string);
    if (!response) {
      continue;
    } else {
      engine.process(JSON.parse(response));
    }
  }
}

main();
