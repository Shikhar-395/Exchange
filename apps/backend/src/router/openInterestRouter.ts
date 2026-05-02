import { Router, Request, Response } from "express";
import axios from "axios";

export const openInterestRouter: Router = Router();

const BACKPACK_OI_URL = "https://api.backpack.exchange/api/v1/openInterest";

openInterestRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { data } = await axios.get(BACKPACK_OI_URL, {
      headers: { accept: "application/json" },
    });
    res.json(data);
  } catch (err) {
    console.error("failed to fetch open interest from backpack:", err);
    res.status(502).json({ message: "upstream error" });
  }
});
