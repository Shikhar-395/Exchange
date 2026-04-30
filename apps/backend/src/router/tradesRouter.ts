import { Router, Request, Response } from "express";

export const tradesRouter: Router = Router();

tradesRouter.get("/", async (req: Request, res: Response) => {
  const { market } = req.query;
  // get from DB
  res.json({});
});
