import { Client } from "pg";

export const timeScaleClient = new Client({
  user: process.env.TIMESCALE_USER,
  host: process.env.TIMESCALE_HOST,
  database: process.env.TIMESCALE_DATABASE,
  password: process.env.TIMESCALE_PASSWORD,
  port: parseInt(process.env.TIMESCALE_PORT ?? "5433"),
});
