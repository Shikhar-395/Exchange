import { Router, Request, Response } from "express";

export const orderRouter: Router = Router();

orderRouter.post("/", async (req: Request, res: Response) => {
  // tell the engine about this , return what the engine told you
});

orderRouter.delete("/", async (req: Request, res: Response) => {
  // tell the engine about this , return what the engine told you
});

orderRouter.get("/", async (req: Request, res: Response) => {
  // tell the engine about this , return what the engine told you
});
