import { createClient } from "redis";
import { Engine } from "./trade/engine";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const redisClient = createClient();
  await redisClient.connect();

  const engine = new Engine();
  await engine.init();
  console.log("engine ready");

  while (true) {
    const response = await redisClient.rPop("messages" as string);
    if (!response) {
      await sleep(100);
      continue;
    }
    engine.process(JSON.parse(response));
  }
}

main();
