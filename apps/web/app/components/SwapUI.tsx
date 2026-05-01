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
    <div>
      <div className="flex flex-col">
        <div className="flex flex-row h-[60px]">
          <BuyButton activeTab={activeTab} setActiveTab={setActiveTab} />
          <SellButton activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="px-3">
            <div className="flex flex-row gap-5">
              <LimitButton type={type} setType={setType} />
              <MarketButton type={type} setType={setType} />
            </div>
          </div>
          <div className="flex flex-col px-3">
            <div className="flex flex-col flex-1 gap-3 text-base-text-high-emphasis">
              <div className="flex items-center justify-between flex-row">
                <p className="text-xs font-normal text-base-text-med-emphasis">
                  Available Balance
                </p>
                <p className="font-medium text-xs">
                  {isAuthed ? "36.94 USDC" : "—"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-normal text-base-text-med-emphasis">
                  Price
                </p>
                <input
                  step="0.01"
                  placeholder="0"
                  className="h-12 rounded-lg border-2 border-solid border-base-border-light bg-transparent pr-12 text-right text-2xl leading-9 placeholder-base-text-med-emphasis focus:border-accent-blue focus:outline-none disabled:opacity-50"
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={type === "market" || !isAuthed}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-3">
              <p className="text-xs font-normal text-base-text-med-emphasis">
                Quantity
              </p>
              <input
                step="0.01"
                placeholder="0"
                className="h-12 rounded-lg border-2 border-solid border-base-border-light bg-transparent pr-12 text-right text-2xl leading-9 placeholder-base-text-med-emphasis focus:border-accent-blue focus:outline-none disabled:opacity-50"
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!isAuthed}
              />
              <div className="flex justify-end flex-row">
                <p className="font-medium pr-2 text-xs text-base-text-med-emphasis">
                  ≈ 0.00 USDC
                </p>
              </div>
              {error && <p className="text-xs text-red-text">{error}</p>}

              {isPending ? (
                <button
                  disabled
                  className="h-12 rounded-xl my-4 bg-base-background-l2 text-base-text-med-emphasis"
                >
                  Loading…
                </button>
              ) : isAuthed ? (
                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={
                    submitting || !quantity || (type === "limit" && !price)
                  }
                  className="font-semibold focus:outline-none text-center h-12 rounded-xl text-base px-4 py-2 my-4 bg-green-primary-button-background text-green-primary-button-text active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? "Placing…"
                    : activeTab === "buy"
                      ? "Buy"
                      : "Sell"}
                </button>
              ) : (
                <Link
                  href="/signin"
                  className="font-semibold text-center h-12 flex items-center justify-center rounded-xl text-base my-4 bg-accent-blue text-white hover:opacity-90"
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

function LimitButton({
  type,
  setType,
}: {
  type: string;
  setType: (t: "limit" | "market") => void;
}) {
  return (
    <div
      className="flex flex-col cursor-pointer justify-center py-2"
      onClick={() => setType("limit")}
    >
      <div
        className={`text-sm font-medium py-1 border-b-2 ${
          type === "limit"
            ? "border-accent-blue text-base-text-high-emphasis"
            : "border-transparent text-base-text-med-emphasis"
        }`}
      >
        Limit
      </div>
    </div>
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
    <div
      className="flex flex-col cursor-pointer justify-center py-2"
      onClick={() => setType("market")}
    >
      <div
        className={`text-sm font-medium py-1 border-b-2 ${
          type === "market"
            ? "border-accent-blue text-base-text-high-emphasis"
            : "border-transparent text-base-text-med-emphasis"
        }`}
      >
        Market
      </div>
    </div>
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
    <div
      className={`flex flex-col mb-[-2px] flex-1 cursor-pointer justify-center border-b-2 p-4 ${
        activeTab === "buy"
          ? "border-b-green-border bg-green-background-transparent"
          : "border-b-base-border-med"
      }`}
      onClick={() => setActiveTab("buy")}
    >
      <p className="text-center text-sm font-semibold text-green-text">Buy</p>
    </div>
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
    <div
      className={`flex flex-col mb-[-2px] flex-1 cursor-pointer justify-center border-b-2 p-4 ${
        activeTab === "sell"
          ? "border-b-red-border bg-red-background-transparent"
          : "border-b-base-border-med"
      }`}
      onClick={() => setActiveTab("sell")}
    >
      <p className="text-center text-sm font-semibold text-red-text">Sell</p>
    </div>
  );
}
