import { Router, Request, Response } from "express";
export const depthRouter: Router = Router();

depthRouter.get("/", async (req: Request, res: Response) => {
  const symbol = req.query.symbol;

  // get the depth and return the json to user
});
