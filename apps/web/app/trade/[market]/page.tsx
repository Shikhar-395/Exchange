"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MarketBar } from "@/app/components/MarketBar";
import { SwapUI } from "@/app/components/SwapUI";
import { TradeView } from "@/app/components/TradeView";
import { Depth } from "@/app/components/depth/Depth";
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
    <div className="exchange-shell flex flex-row flex-1">
      <div className="flex flex-col flex-1">
        <MarketBar market={m} />
        <div className="flex flex-row h-[920px] border-y border-base-border-light">
          <div className="flex flex-col flex-1">
            <TradeView market={m} />
          </div>
          <div className="flex flex-col w-[250px] overflow-hidden">
            <Depth market={m} />
          </div>
        </div>
      </div>
      <div className="w-[10px] flex-col border-l border-base-border-light" />
      <div>
        <div className="flex flex-col w-[250px]">
          <SwapUI market={m} />
        </div>
      </div>
    </div>
  );
}
