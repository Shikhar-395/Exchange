import { timeScaleClient } from "./timescaleClient";

async function refreshViews() {
  await refresh1m();
  await refresh1h();
  await refresh1w();
  console.log("Materialized views refreshed");
}

async function refresh1m() {
  await timeScaleClient.query("REFRESH MATERIALIZED VIEW klines_1m");
}

async function refresh1h() {
  await timeScaleClient.query("REFRESH MATERIALIZED VIEW klines_1h");
}

async function refresh1w() {
  await timeScaleClient.query("REFRESH MATERIALIZED VIEW klines_1w");
}

export function startCron() {
  refreshViews().catch(console.error);
  setInterval(() => refresh1m().catch(console.error), 10_000);
  setInterval(() => refresh1h().catch(console.error), 60_000);
  setInterval(() => refresh1w().catch(console.error), 60 * 60_000);
  console.log("cron started");
}

// standalone: pnpm cron
if (process.argv[1]?.endsWith("cron.ts")) {
  timeScaleClient.connect().then(startCron).catch(console.error);
}
