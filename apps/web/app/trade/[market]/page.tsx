"use client";
import { useParams } from "next/navigation";
import { MarketBar } from "@/app/components/MarketBar";
import { SwapUI } from "@/app/components/SwapUI";
import { TradeView } from "@/app/components/TradeView";
import { Depth } from "@/app/components/depth/Depth";

export default function Page() {
  const { market } = useParams();
  const m = market as string;
  return (
    <div className="exchange-shell flex flex-row flex-1">
      <div className="flex flex-col flex-1">
        <MarketBar market={m} />
        <div className="flex flex-row h-[920px] border-y border-slate-800">
          <div className="flex flex-col flex-1">
            <TradeView market={m} />
          </div>
          <div className="flex flex-col w-[250px] overflow-hidden">
            <Depth market={m} />
          </div>
        </div>
      </div>
      <div className="w-[10px] flex-col border-slate-800 border-l" />
      <div>
        <div className="flex flex-col w-[250px]">
          <SwapUI market={m} />
        </div>
      </div>
    </div>
  );
}
