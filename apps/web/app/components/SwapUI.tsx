"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth";
import { createOrder } from "../utils/httpClient";

export function SwapUI({ market }: { market: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthed = !!session?.user;

  async function placeOrder() {
    if (!session?.user) return;
    setError(null);
    setSubmitting(true);
    try {
      await createOrder({
        market,
        price,
        quantity,
        side: activeTab,
        userId: session.user.id,
      });
      setQuantity("");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full bg-[#090d14] p-3">
      <div className="overflow-hidden rounded-2xl border border-[#1a2232] bg-[#0d1320] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-2 border-b border-[#1a2232]">
          <BuyButton activeTab={activeTab} setActiveTab={setActiveTab} />
          <SellButton activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        <div className="p-4">
          <div className="mb-4 inline-flex rounded-lg border border-[#1d2a3d] bg-[#0a1019] p-1">
            <LimitButton type={type} setType={setType} />
            <MarketButton type={type} setType={setType} />
          </div>

          <div className="mb-3 flex items-center justify-between text-[12px]">
            <p className="text-[#8ea0ba]">Available Balance</p>
            <p className="font-semibold text-[#e6edf7]">
              {isAuthed ? "36.94 USDC" : "—"}
            </p>
          </div>

          <div className="space-y-3">
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

          <div className="mt-2 flex justify-end">
            <p className="text-xs text-[#8ea0ba]">≈ 0.00 USDC</p>
          </div>

          {error && <p className="mt-2 text-xs text-[#e35d66]">{error}</p>}

          {isPending ? (
            <button
              disabled
              className="mt-4 h-12 w-full rounded-xl bg-[#151f2f] text-[#8ea0ba]"
            >
              Loading…
            </button>
          ) : isAuthed ? (
            <button
              type="button"
              onClick={placeOrder}
              disabled={submitting || !quantity || (type === "limit" && !price)}
              className={`mt-4 h-12 w-full rounded-xl text-base font-semibold text-[#00140f] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                activeTab === "buy"
                  ? "bg-[#0abf8a] hover:bg-[#0fce96]"
                  : "bg-[#e35d66] text-[#22070b] hover:bg-[#ed6b74]"
              }`}
            >
              {submitting ? "Placing…" : activeTab === "buy" ? "Buy" : "Sell"}
            </button>
          ) : (
            <Link
              href="/signin"
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#2b6cf0] text-base font-semibold text-white hover:opacity-90"
            >
              Sign in to trade
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function LimitButton({
  type,
  setType,
}: {
  type: string;
  setType: (t: "limit" | "market") => void;
}) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        type === "limit"
          ? "bg-[#1a2a41] text-[#dfe8f6]"
          : "text-[#8ea0ba] hover:text-[#cdd8ea]"
      }`}
      onClick={() => setType("limit")}
    >
      Limit
    </button>
  );
}

function MarketButton({
  type,
  setType,
}: {
  type: string;
  setType: (t: "limit" | "market") => void;
}) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        type === "market"
          ? "bg-[#1a2a41] text-[#dfe8f6]"
          : "text-[#8ea0ba] hover:text-[#cdd8ea]"
      }`}
      onClick={() => setType("market")}
    >
      Market
    </button>
  );
}

function BuyButton({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (t: "buy" | "sell") => void;
}) {
  return (
    <button
      className={`h-12 text-sm font-semibold transition ${
        activeTab === "buy"
          ? "bg-[#0e2a24] text-[#0fd19a]"
          : "bg-transparent text-[#8ea0ba] hover:bg-[#131e2e]"
      }`}
      onClick={() => setActiveTab("buy")}
    >
      Buy
    </button>
  );
}

function SellButton({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (t: "buy" | "sell") => void;
}) {
  return (
    <button
      className={`h-12 text-sm font-semibold transition ${
        activeTab === "sell"
          ? "bg-[#331920] text-[#ff4d5e]"
          : "bg-transparent text-[#8ea0ba] hover:bg-[#131e2e]"
      }`}
      onClick={() => setActiveTab("sell")}
    >
      Sell
    </button>
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
      <p className="mb-1.5 text-xs text-[#8ea0ba]">{label}</p>
      <input
        step="0.01"
        placeholder="0"
        className="h-12 w-full rounded-xl border border-[#1d2a3d] bg-[#0a1019] px-4 text-right text-[34px] leading-none text-[#dfe8f6] placeholder:text-[#607089] focus:border-[#2b6cf0] focus:outline-none disabled:opacity-50"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
