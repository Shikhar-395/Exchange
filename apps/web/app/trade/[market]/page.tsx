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
    <div className="exchange-shell flex min-h-[calc(100vh-56px)] w-full flex-row overflow-hidden bg-[#090d14] text-[#dce4ef]">
      <div className="flex min-h-0 min-w-0 flex-col flex-1 overflow-y-auto">
        <MarketBar market={m} />
        <div className="flex h-[620px] flex-row border-y border-[#1a2232]">
          <div className="flex min-h-[620px] min-w-0 flex-col flex-1">
            <TradeView market={m} />
          </div>
          <div className="flex min-h-[620px] w-[300px] flex-col overflow-hidden border-l border-[#1a2232]">
            <Depth market={m} />
          </div>
        </div>
        <BottomDashboardMock />
      </div>
      <div className="relative flex min-h-0 shrink-0 bg-[#090d14]">
        <div className="sticky top-0 flex h-screen w-[320px] shrink-0 flex-col border-l border-[#1a2232] bg-[#090d14]">
          <SwapUI market={m} />
        </div>
      </div>
    </div>
  );
}
