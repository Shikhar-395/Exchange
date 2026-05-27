import { BASE_CURRENCY, GET_BALANCE } from "@repo/common/consts";
import { Router, Request, Response } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { RedisManager } from "../redisManager";

export const balanceRouter: Router = Router();

balanceRouter.get("/", authMiddleware, async (req: Request, res: Response) => {
  const currency =
    typeof req.query.currency === "string" && req.query.currency
      ? req.query.currency
      : BASE_CURRENCY;

  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_BALANCE,
    data: {
      userId: req.userId!,
      currency,
    },
  });

  res.json(response.payload);
});
