import { Router, Request, Response } from "express";
import { RedisManager } from "../redisManager";
import {
  CREATE_ORDER,
  CANCEL_ORDER,
  GET_OPEN_ORDERS,
} from "@repo/common/consts";

export const orderRouter: Router = Router();

orderRouter.post("/", async (req: Request, res: Response) => {
  const { market, price, quantity, side, userId } = req.body;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CREATE_ORDER,
    data: { market, price, quantity, side, userId },
  });
  res.json(response.payload);
});

orderRouter.delete("/", async (req: Request, res: Response) => {
  const { orderId, market } = req.body;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CANCEL_ORDER,
    data: { orderId, market },
  });
  res.json(response.payload);
});

orderRouter.get("/open", async (req: Request, res: Response) => {
  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_OPEN_ORDERS,
    data: {
      userId: req.query.userId as string,
      market: req.query.market as string,
    },
  });
  res.json(response.payload);
});
