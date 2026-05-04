import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const NAMES: Record<string, string> = {
  "0G": "0G",
  "2Z": "2Z",
  AAVE: "Aave",
  ADA: "Cardano",
  AERO: "Aerodrome",
  APE: "ApeCoin",
  APT: "Aptos",
  ARB: "Arbitrum",
  ASTER: "Aster",
  AVAX: "Avalanche",
  AVNT: "Avantis",
  BERA: "Berachain",
  BLUE: "Blue",
  BNB: "BNB",
  BONK: "Bonk",
  BP: "BP",
  BTC: "Bitcoin",
  CC: "CC",
  CLOUD: "Cloud",
  CRV: "Curve",
  DEEP: "Deep",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
  EDGE: "Edge",
  ENA: "Ethena",
  ES: "ES",
  ETH: "Ethereum",
  FARTCOIN: "Fartcoin",
  FLOCK: "Flock",
  FOGO: "Fogo",
  HBAR: "Hedera",
  HYPE: "Hyperliquid",
  IO: "io.net",
  IP: "IP",
  JTO: "Jito",
  JUP: "Jupiter",
  KAITO: "Kaito",
  KMNO: "Kamino",
  kBONK: "kBonk",
  kPEPE: "kPepe",
  kSHIB: "kShiba",
  LDO: "Lido",
  LINEA: "Linea",
  LINK: "Chainlink",
  LIT: "Lit Protocol",
  LTC: "Litecoin",
  MEGA: "Mega",
  MET: "Met",
  MNT: "Mantle",
  MON: "Monad",
  NEAR: "NEAR",
  ONDO: "Ondo",
  OP: "Optimism",
  PAXG: "PAX Gold",
  PENDLE: "Pendle",
  PENGU: "Pengu",
  PEPE: "Pepe",
  PIPE: "Pipe",
  POL: "Polygon",
  PUMP: "Pump",
  PYTH: "Pyth",
  RAY: "Raydium",
  RENDER: "Render",
  S: "Sonic",
  SEI: "Sei",
  SHIB: "Shiba Inu",
  SKR: "SKR",
  SOL: "Solana",
  STABLE: "Stable",
  STRK: "Starknet",
  SUI: "Sui",
  TAO: "Bittensor",
  TIA: "Celestia",
  TON: "Toncoin",
  TRUMP: "Trump",
  UNI: "Uniswap",
  USDT: "Tether",
  VIRTUAL: "Virtual",
  W: "Wormhole",
  WAL: "Walrus",
  WIF: "dogwifhat",
  WLFI: "World Liberty Fi",
  WLD: "Worldcoin",
  XLM: "Stellar",
  XMR: "Monero",
  XPL: "XPL",
  XRP: "XRP",
  ZAMA: "Zama",
  ZEC: "Zcash",
  ZORA: "Zora",
  ZRO: "LayerZero",
};

const TOP_BASES = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "BNB",
  "DOGE",
  "ADA",
  "AVAX",
  "LINK",
  "SUI",
  "TON",
  "DOT",
  "LTC",
  "NEAR",
  "PEPE",
];

const RAW_SYMBOLS = TOP_BASES.flatMap((base) => [
  `${base}_USDC`,
  `${base}_USDC_PERP`,
]);

function parseSymbol(symbol: string): {
  baseCurrency: string;
  quoteCurrency: string;
  category: "SPOT" | "FUTURES";
} {
  const isPerp = symbol.endsWith("_PERP");
  const base = isPerp
    ? symbol.slice(0, -"_USDC_PERP".length)
    : symbol.slice(0, -"_USDC".length);
  return {
    baseCurrency: base,
    quoteCurrency: "USDC",
    category: isPerp ? "FUTURES" : "SPOT",
  };
}

async function main() {
  const markets = RAW_SYMBOLS.map((symbol) => {
    const { baseCurrency, quoteCurrency, category } = parseSymbol(symbol);
    return {
      symbol,
      baseCurrency,
      quoteCurrency,
      name: NAMES[baseCurrency] ?? baseCurrency,
      category: category as "SPOT" | "FUTURES",
      tags: [] as string[],
      minOrderSize: 0.001,
      tickSize: 0.01,
      isActive: true,
    };
  });

  const keep = markets.map((m) => m.symbol);
  const removed = await prisma.market.deleteMany({
    where: { symbol: { notIn: keep } },
  });
  await prisma.market.createMany({ data: markets, skipDuplicates: true });
  console.log(
    `Seeded ${markets.length} markets, removed ${removed.count} stale`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
