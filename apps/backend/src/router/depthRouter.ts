import { Router, Request, Response } from "express";
import { RedisManager } from "../redisManager";
import { GET_DEPTH } from "@repo/common/consts";

export const depthRouter: Router = Router();

depthRouter.get("/", async (req: Request, res: Response) => {
  const symbol = req.query.symbol as string;
  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_DEPTH,
    data: { market: symbol },
  });
  res.json(response.payload);
});
