import express, { Request, Response } from "express";
import { prisma } from "@repo/database/client";
const app = express();


app.get("/", async (req: Request, res: Response) => {
  try {

    await prisma.user.create({
      data: {
        name: "Adsf"
      }
    });
    console.log("Success");
    res.json({
      msg: "Success"
    })
  } catch (err) {
    console.log("failed", err);

    res.status(500).json({
      msg: "failed"
    })
  }
});


app.listen(3001, () => {
  console.log("server running on port 3001");
});
