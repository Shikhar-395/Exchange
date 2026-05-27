"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth";
import { createOrder, getBalance } from "../utils/httpClient";
import { HoverBorderGradient } from "@/components/hover-border-gradient";
import { cn } from "@repo/ui/lib/utils";
import { motion } from "framer-motion";

export function SwapUI({ market }: { market: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const isAuthed = !!session?.user;

  async function loadBalance() {
    if (!session?.user) {
      setAvailableBalance(null);
      return;
    }
    setIsBalanceLoading(true);
    try {
      const balance = await getBalance("USDC");
      setAvailableBalance(balance.available);
    } catch {
      setAvailableBalance(null);
    } finally {
      setIsBalanceLoading(false);
    }
  }

  useEffect(() => {
    loadBalance();
  }, [session?.user?.id]);

  async function placeOrder() {
    if (!session?.user) return;
    if (type === "market") {
      setError("Market orders are not supported yet.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createOrder({
        market,
        price,
        quantity,
        side: activeTab,
      });
      setQuantity("");
      await loadBalance();
      window.dispatchEvent(new CustomEvent("exchange:orders-changed"));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full bg-[#090d14] p-2 pb-3">
      {/* Outer Card with subtle glassmorphic frame */}
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-[#0d1320] shadow-[0_12px_40px_rgba(0,0,0,0.5)] animate-fade-in">
        {/* Buy / Sell Tabs with fluid slider */}
        <div className="relative grid grid-cols-2 border-b border-[#1a2232]/80 bg-black/15 shrink-0 p-1">
          <motion.div
            layoutId="swapui-buy-sell-indicator"
            className={cn(
              "absolute inset-y-1 rounded-lg transition-colors duration-500",
              activeTab === "buy"
                ? "bg-[#0e2a24]/90 left-1 right-[50%]"
                : "bg-[#331920]/90 left-[50%] right-1",
            )}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
          />
          <button
            className={cn(
              "relative z-10 h-10 text-xs font-extrabold uppercase tracking-wider transition-colors duration-300 cursor-pointer rounded-lg",
              activeTab === "buy"
                ? "text-[#0fd19a]"
                : "text-[#8ea0ba] hover:text-[#dfe8f6]",
            )}
            onClick={() => setActiveTab("buy")}
          >
            Buy
          </button>
          <button
            className={cn(
              "relative z-10 h-10 text-xs font-extrabold uppercase tracking-wider transition-colors duration-300 cursor-pointer rounded-lg",
              activeTab === "sell"
                ? "text-[#ff4d5e]"
                : "text-[#8ea0ba] hover:text-[#dfe8f6]",
            )}
            onClick={() => setActiveTab("sell")}
          >
            Sell
          </button>
        </div>

        {/* Outer Padding wrapper for the Inner nested card */}
        <div className="flex flex-1 flex-col p-3.5 pb-4 min-h-0">
          {/* Inner Card (nested border & darker background) */}
          <div className="flex flex-1 flex-col rounded-[18px] border border-white/[0.04] bg-black/35 shadow-inner p-4 backdrop-blur-md min-h-0">
            {/* Top inputs area */}
            <div className="space-y-4">
              {/* Limit / Market Tab Selector with spring-action slide pill */}
              <div className="relative inline-flex rounded-xl border border-white/[0.05] bg-black/25 p-1">
                <motion.div
                  layoutId="swapui-limit-market-indicator"
                  className="absolute inset-y-1 bg-[#1d2d44] border border-white/[0.08] rounded-lg"
                  style={{
                    left: type === "limit" ? "4px" : "calc(50% + 2px)",
                    right: type === "limit" ? "calc(50% + 2px)" : "4px",
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
                <button
                  className={cn(
                    "relative z-10 rounded-lg px-4 py-1.5 text-xs font-bold transition duration-200 cursor-pointer",
                    type === "limit"
                      ? "text-[#dfe8f6]"
                      : "text-[#8ea0ba] hover:text-[#cdd8ea]",
                  )}
                  onClick={() => setType("limit")}
                >
                  Limit
                </button>
                <button
                  className={cn(
                    "relative z-10 rounded-lg px-4 py-1.5 text-xs font-bold transition duration-200 cursor-pointer",
                    type === "market"
                      ? "text-[#dfe8f6]"
                      : "text-[#8ea0ba] hover:text-[#cdd8ea]",
                  )}
                  onClick={() => setType("market")}
                >
                  Market
                </button>
              </div>

              {/* Available Balance Row */}
              <div className="flex items-center justify-between text-xs border-b border-white/[0.03] pb-2">
                <p className="text-[#8ea0ba] font-medium">Available Balance</p>
                <p className="font-bold text-[#dfe8f6] tabular-nums">
                  {isAuthed
                    ? isBalanceLoading
                      ? "Loading…"
                      : availableBalance === null
                        ? "—"
                        : `${availableBalance.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })} USDC`
                    : "—"}
                </p>
              </div>

              {/* Inset Input Fields */}
              <div className="space-y-3.5">
                <Field
                  label="Price"
                  value={price}
                  onChange={setPrice}
                  disabled={type === "market" || !isAuthed}
                />
                <Field
                  label="Quantity"
                  value={quantity}
                  onChange={setQuantity}
                  disabled={!isAuthed}
                />
              </div>

              {/* Equivalence Row */}
              <div className="flex justify-end">
                <p className="text-[11px] font-semibold text-[#8ea0ba] tabular-nums">
                  ≈ 0.00 USDC
                </p>
              </div>

              {type === "market" && (
                <p className="text-[11px] font-medium text-[#8ea0ba]">
                  Market orders are coming soon. Use a limit order for now.
                </p>
              )}
            </div>

            {/* Bottom actions area pushed to the bottom of the card */}
            <div className="mt-auto pt-4">
              {error && (
                <p className="mb-3 text-xs text-[#e35d66] font-medium">
                  {error}
                </p>
              )}

              {/* Trading Action Button */}
              {isPending ? (
                <button
                  disabled
                  className="h-12 w-full rounded-xl bg-white/[0.05] text-[#8ea0ba] border border-white/[0.05] font-semibold animate-pulse"
                >
                  Loading…
                </button>
              ) : isAuthed ? (
                <HoverBorderGradient
                  type="button"
                  onClick={placeOrder}
                  disabled={
                    submitting || !quantity || (type === "limit" && !price)
                  }
                  variant={activeTab}
                  duration={4}
                  containerClassName="w-full rounded-xl active:scale-[0.98]"
                  className={cn(
                    "flex items-center justify-center h-[46px] rounded-xl text-base font-bold cursor-pointer transition-all duration-700 ease-out",
                    activeTab === "buy"
                      ? "bg-[#0c1c18]/90 text-[#0fd19a] hover:bg-[#0f2e25]/90 hover:text-[#12e3a8]"
                      : "bg-[#251015]/90 text-[#ff4d5e] hover:bg-[#3d161e]/90 hover:text-[#ff6675]",
                  )}
                >
                  {submitting
                    ? "Placing…"
                    : activeTab === "buy"
                      ? "Buy"
                      : "Sell"}
                </HoverBorderGradient>
              ) : (
                <Link
                  href="/signin"
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#2b6cf0] text-base font-bold text-white shadow-[0_0_12px_rgba(43,108,240,0.25)] border border-[#4c96ff]/20 hover:brightness-105 transition active:scale-[0.98]"
                >
                  Sign in to trade
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[#8ea0ba]">{label}</p>
      <input
        step="0.01"
        placeholder="0"
        className="h-12 w-full rounded-xl border border-white/[0.04] bg-black/40 px-4 text-right text-[26px] font-bold leading-none text-[#dfe8f6] placeholder:text-[#607089] focus:border-[var(--auth-color-primary)] focus:shadow-[0_0_12px_rgba(37,99,235,0.15)] focus:outline-none transition-all disabled:opacity-50"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
