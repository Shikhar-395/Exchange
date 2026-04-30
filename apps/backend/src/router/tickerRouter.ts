import { Router, Request, Response } from "express";

export const tickersRouter: Router = Router();

tickersRouter.get("/", async (req: Request, res: Response) => {
  res.json({});
});
