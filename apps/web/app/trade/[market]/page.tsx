"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MarketBar } from "@/app/components/MarketBar";
import { SwapUI } from "@/app/components/SwapUI";
import { TradeView } from "@/app/components/TradeView";
import { Depth } from "@/app/components/depth/Depth";
import { BottomDashboardMock } from "@/app/components/BottomDashboardMock";
import { authClient } from "@/lib/auth";
import { Button } from "@repo/ui/components/button";
import { motion } from "framer-motion";

export default function Page() {
  const { market } = useParams();
  const m = market as string;
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="exchange-shell flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full border border-[var(--auth-border)] bg-[var(--auth-surface-strong)]" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="exchange-shell flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-[var(--auth-text)]">
          Sign in to trade
        </p>
        <div className="flex gap-3">
          <Button
            asChild
            variant="ghost"
            className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-surface-strong)] px-4 text-[var(--auth-text)] hover:bg-[var(--auth-surface)]"
          >
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button
            asChild
            className="rounded-xl border border-[var(--auth-border)] bg-[var(--auth-color-primary)] px-4 text-[var(--app-color-foreground)] hover:brightness-105"
          >
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="exchange-shell flex h-[calc(100vh-60px)] w-full flex-row overflow-hidden bg-[#090d14] text-[#dce4ef] px-3 pt-2 pb-6 gap-3"
    >
      {/* Left Column: Ticker, Chart, Depth, and Balances */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
        className="flex min-h-0 min-w-0 flex-col flex-1 gap-2 overflow-hidden"
      >
        {/* Ticker Bar Card */}
        <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-[#0b0f17] shrink-0 shadow-sm">
          <MarketBar market={m} />
        </div>

        {/* Middle row: Chart + Orderbook */}
        <div className="flex flex-1 min-h-0 flex-row gap-4">
          {/* TradingView Chart Card */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-[#0b0f17] shadow-sm">
            <TradeView market={m} />
          </div>

          {/* Depth / Orderbook Card */}
          <div className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-[#0b0f17] shadow-sm">
            <Depth market={m} />
          </div>
        </div>

        {/* Bottom Balances Card */}
        <div className="h-[210px] shrink-0 overflow-hidden rounded-xl border border-white/[0.05] bg-[#0b1019] shadow-sm">
          <BottomDashboardMock market={m} />
        </div>
      </motion.div>

      {/* Right Column: Swap Action Panel */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
        className="h-full w-[310px] shrink-0"
      >
        <SwapUI market={m} />
      </motion.div>
    </motion.div>
  );
}
