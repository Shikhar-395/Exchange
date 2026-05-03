"use client";

import { useMemo, useState } from "react";

type BottomTab =
  | "Balances"
  | "Open Orders"
  | "TWAP"
  | "Fill History"
  | "Order History"
  | "Position History"
  | "Funding History";

const TABS: BottomTab[] = [
  "Balances",
  "Open Orders",
  "TWAP",
  "Fill History",
  "Order History",
  "Position History",
  "Funding History",
];

const ASSETS = [
  { symbol: "USD", name: "US Dollar", tag: "", color: "bg-[#1dbf73]" },
  { symbol: "BP", name: "Backpack", tag: "Stake", color: "bg-[#ff5d5d]" },
  { symbol: "SOL", name: "Solana", tag: "", color: "bg-[#32d4c0]" },
  { symbol: "BTC", name: "Bitcoin", tag: "", color: "bg-[#f7931a]" },
  { symbol: "USDT", name: "USDT", tag: "", color: "bg-[#26a17b]" },
  { symbol: "ETH", name: "Ethereum", tag: "", color: "bg-[#627eea]" },
];

export function BottomDashboardMock() {
  const [tab, setTab] = useState<BottomTab>("Balances");

  const totalBalance = useMemo(() => "$0.00", []);

  return (
    <div className="border-t border-[#1a2232] bg-[#0b1019]">
      <div className="flex items-center gap-2 px-3 py-2">
        {TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              tab === item
                ? "bg-[#182334] text-[#dfe8f6]"
                : "text-[#8ea0ba] hover:bg-[#121a28] hover:text-[#ced9ea]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="border-t border-[#131a28] px-3 py-2">
        <div className="mb-2 flex items-center justify-between text-xs">
          <div className="text-[#8ea0ba]">
            <span className="mr-2">Your Balances</span>
            <span className="font-semibold text-[#dfe8f6]">{totalBalance}</span>
          </div>
          <label className="flex items-center gap-2 text-[#8ea0ba]">
            <input type="checkbox" className="accent-[#2b6cf0]" />
            Hide zero balances
          </label>
        </div>

        {tab === "Balances" ? (
          <div className="overflow-hidden rounded-lg border border-[#1a2232]">
            <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_220px] border-b border-[#1a2232] bg-[#0f1522] px-3 py-2 text-[11px] text-[#8ea0ba]">
              <div>Asset</div>
              <div className="text-right">Total Balance</div>
              <div className="text-right">Available Balance</div>
              <div className="text-right">Open Orders</div>
              <div />
            </div>
            {ASSETS.map((asset) => (
              <div
                key={asset.symbol}
                className="grid grid-cols-[2.2fr_1fr_1fr_1fr_220px] items-center border-b border-[#131a28] px-3 py-2 text-sm last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-[#09101a] ${asset.color}`}
                  >
                    {asset.symbol[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-[#dfe8f6]">
                      <span>{asset.name}</span>
                      {asset.tag && (
                        <span className="rounded bg-[#163861] px-1.5 py-0.5 text-[10px] text-[#9ec1ff]">
                          {asset.tag}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#72839e]">{asset.symbol}</div>
                  </div>
                </div>
                <div className="text-right text-[#dfe8f6]">$0.00</div>
                <div className="text-right text-[#dfe8f6]">$0.00</div>
                <div className="text-right text-[#dfe8f6]">0</div>
                <div className="flex items-center justify-end gap-4 text-sm font-semibold">
                  <button className="text-[#4c96ff] hover:text-[#72adff]">
                    Deposit
                  </button>
                  <button className="text-[#4c96ff] hover:text-[#72adff]">
                    Withdraw
                  </button>
                  <button className="text-[#6d7f99] hover:text-[#9fb0c8]">
                    ⋮
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center rounded-lg border border-[#1a2232] bg-[#0f1522] text-sm text-[#8295b0]">
            {tab} mock panel (client-side dummy content)
          </div>
        )}
      </div>
    </div>
  );
}
