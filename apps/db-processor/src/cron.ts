import { timeScaleClient } from "@repo/database/timescale";

async function refreshViews() {
  await timeScaleClient.query("REFRESH MATERIALIZED VIEW klines_1m");
  await timeScaleClient.query("REFRESH MATERIALIZED VIEW klines_1h");
  await timeScaleClient.query("REFRESH MATERIALIZED VIEW klines_1w");

  console.log("Materialized views refreshed successfully");
}

refreshViews().catch(console.error);

setInterval(() => {
  refreshViews();
}, 1000 * 10);
