import { DbMessage } from "@repo/common/dbMessages";
import { prisma } from "@repo/database/client";
import { timeScaleClient } from "./timescaleClient";
import { createClient, RedisClientType } from "redis";
import { startCron } from "./cron";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function orderStatus(quantity: number, filled: number) {
  if (filled <= 0) return "OPEN";
  return filled >= quantity ? "FILLED" : "PARTIALLY_FILLED";
}

async function handleOrderUpdate(
  data: Extract<DbMessage, { type: "ORDER_UPDATE" }>["data"],
) {
  if (data.status === "CANCELLED") {
    await prisma.order
      .update({
        where: { id: data.orderId },
        data: { status: "CANCELLED" },
      })
      .catch(() => {});
    return;
  }

  if (data.market && data.price && data.quantity && data.side && data.userId) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true },
    });
    if (!user) return;

    const quantity = Number(data.quantity);
    const filled = Number(data.executedQty);
    await prisma.order.upsert({
      where: { id: data.orderId },
      create: {
        id: data.orderId,
        userId: data.userId,
        market: data.market,
        side: data.side.toUpperCase() as "BUY" | "SELL",
        price: data.price,
        quantity: data.quantity,
        filled: data.executedQty,
        status: data.status ?? orderStatus(quantity, filled),
      },
      update: {
        market: data.market,
        side: data.side.toUpperCase() as "BUY" | "SELL",
        price: data.price,
        quantity: data.quantity,
        filled: data.executedQty,
        status: data.status ?? orderStatus(quantity, filled),
      },
    });
    return;
  }

  if (data.executedQty <= 0) return;
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    select: { filled: true, quantity: true },
  });
  if (!order) return;

  const nextFilled = Number(order.filled) + Number(data.executedQty);
  await prisma.order.update({
    where: { id: data.orderId },
    data: {
      filled: nextFilled,
      status: orderStatus(Number(order.quantity), nextFilled),
    },
  });
}

async function main() {
  await timeScaleClient.connect();
  console.log("connected to timescale");

  const redisClient: RedisClientType = createClient({
    url: process.env.REDIS_URL,
  });
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
    } else if (data.type === "ORDER_UPDATE") {
      await handleOrderUpdate(data.data);
    }
  }
}

main();
