import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "@repo/database/client";
import { RedisManager } from "../redisManager";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  CREATE_ORDER,
  CANCEL_ORDER,
  GET_OPEN_ORDERS,
} from "@repo/common/consts";

export const orderRouter: Router = Router();

function orderIdentityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const serviceToken = process.env.MARKET_MAKER_SERVICE_TOKEN;
  const requestToken = req.get("x-market-maker-token");

  if (serviceToken && requestToken === serviceToken) {
    req.userId = process.env.MARKET_MAKER_USER_ID ?? "5";
    return next();
  }

  return authMiddleware(req, res, next);
}

function parsePositiveNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

orderRouter.post(
  "/",
  orderIdentityMiddleware,
  async (req: Request, res: Response) => {
    const { market, price, quantity, side } = req.body;

    if (typeof market !== "string" || !market) {
      return res.status(400).json({ message: "Market is required" });
    }

    if (side !== "buy" && side !== "sell") {
      return res.status(400).json({ message: "Side must be buy or sell" });
    }

    if (parsePositiveNumber(price) === null) {
      return res.status(400).json({
        message:
          "Only limit orders with a positive price are supported right now",
      });
    }

    if (parsePositiveNumber(quantity) === null) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }

    const response = await RedisManager.getInstance().sendAndAwait({
      type: CREATE_ORDER,
      data: { market, price, quantity, side, userId: req.userId! },
    });

    if (response.type === "ORDER_REJECTED") {
      return res.status(400).json({ message: response.payload.message });
    }

    res.json(response.payload);
  },
);

orderRouter.delete(
  "/",
  orderIdentityMiddleware,
  async (req: Request, res: Response) => {
    const { orderId, market } = req.body;
    const response = await RedisManager.getInstance().sendAndAwait({
      type: CANCEL_ORDER,
      data: { orderId, market, userId: req.userId! },
    });
    res.json(response.payload);
  },
);

orderRouter.get(
  "/history",
  authMiddleware,
  async (req: Request, res: Response) => {
    const market = typeof req.query.market === "string" ? req.query.market : "";
    const orders = await prisma.order.findMany({
      where: {
        userId: req.userId!,
        ...(market ? { market } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(
      orders.map((order) => ({
        orderId: order.id,
        market: order.market,
        side: order.side.toLowerCase(),
        price: order.price?.toString() ?? "",
        quantity: order.quantity.toString(),
        executedQty: Number(order.filled),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
    );
  },
);

orderRouter.get(
  "/open",
  orderIdentityMiddleware,
  async (req: Request, res: Response) => {
    const response = await RedisManager.getInstance().sendAndAwait({
      type: GET_OPEN_ORDERS,
      data: {
        userId: req.userId!,
        market: req.query.market as string,
      },
    });
    res.json(response.payload);
  },
);
