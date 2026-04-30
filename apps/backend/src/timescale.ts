import { Client } from "pg";

export const timeScaleClient = new Client({
  user: "exchange",
  host: "localhost",
  database: "exchange",
  password: "nagmani",
  port: 5433,
});

export async function connectTimescale() {
  await timeScaleClient.connect();
  await timeScaleClient.query("SELECT 1");
}
