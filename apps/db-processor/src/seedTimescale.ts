import { prisma } from "@repo/database/client";
import { timeScaleClient } from "./timescaleClient";

async function initializeDB() {
  await timeScaleClient.connect();

  const markets = await prisma.market.findMany({
    where: { isActive: true },
    select: { symbol: true },
    orderBy: { symbol: "asc" },
  });

  console.log(`Found ${markets.length} active markets:`);
  markets.forEach((m) => console.log(`  - ${m.symbol}`));

  // Single hypertable for all markets' trade data
  await timeScaleClient.query(`
    CREATE TABLE IF NOT EXISTS trades (
      time           TIMESTAMPTZ      NOT NULL,
      market         VARCHAR(50)      NOT NULL,
      price          DOUBLE PRECISION NOT NULL,
      quantity       DOUBLE PRECISION NOT NULL,
      quote_quantity DOUBLE PRECISION NOT NULL
    );
  `);

  await timeScaleClient.query(`
    SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);
  `);

  await timeScaleClient.query(`
    CREATE INDEX IF NOT EXISTS idx_trades_market_time ON trades (market, time DESC);
  `);

  console.log("Created trades hypertable");

  const intervals: [string, string][] = [
    ["1m", "1 minute"],
    ["1h", "1 hour"],
    ["1w", "1 week"],
  ];

  for (const [name, bucket] of intervals) {
    await timeScaleClient.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS klines_${name} AS
      SELECT
        time_bucket('${bucket}', time) AS bucket,
        market,
        first(price, time)  AS open,
        max(price)          AS high,
        min(price)          AS low,
        last(price, time)   AS close,
        sum(quantity)       AS volume,
        sum(quote_quantity) AS quote_volume,
        count(*)            AS trades
      FROM trades
      GROUP BY bucket, market
      WITH NO DATA;
    `);
    console.log(`Created materialized view: klines_${name}`);
  }

  await timeScaleClient.end();
  await prisma.$disconnect();

  console.log(`TimescaleDB initialized — ${markets.length} markets supported`);
}

initializeDB().catch(console.error);
