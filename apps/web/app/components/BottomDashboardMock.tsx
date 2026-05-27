"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  cancelOrder,
  getBalance,
  getOpenOrders,
  getOrderHistory,
} from "../utils/httpClient";
import { Balance, OpenOrder, OrderHistoryItem } from "../utils/types";
import { formatAmount, formatPrice, splitMarket } from "./depth/format";

type BottomTab = "Balances" | "Open Orders" | "Order History";

const TABS: BottomTab[] = ["Balances", "Open Orders", "Order History"];

const ASSET_META: Record<string, { name: string; color: string }> = {
  USDC: { name: "USD Coin", color: "bg-[#2775ca]" },
  BTC: { name: "Bitcoin", color: "bg-[#f7931a]" },
  ETH: { name: "Ethereum", color: "bg-[#627eea]" },
  SOL: { name: "Solana", color: "bg-[#32d4c0]" },
  BNB: { name: "BNB", color: "bg-[#f3ba2f]" },
  XRP: { name: "XRP", color: "bg-[#7f8ea4]" },
};

export function BottomDashboardMock({ market }: { market: string }) {
  const [tab, setTab] = useState<BottomTab>("Balances");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { base, quote } = splitMarket(market);

  const balanceCurrencies = useMemo(
    () => Array.from(new Set([quote, base].filter(Boolean))),
    [base, quote],
  );

  const totalBalanceLabel = useMemo(() => {
    const quoteBalance = balances.find((b) => b.currency === quote);
    if (!quoteBalance) return "—";
    return `${formatAmount(quoteBalance.available + quoteBalance.locked)} ${quote}`;
  }, [balances, quote]);

  async function refreshDashboard(focusOrders = false) {
    setLoading(true);
    setError(null);
    try {
      const [nextBalances, nextOpenOrders, nextHistory] = await Promise.all([
        Promise.all(balanceCurrencies.map((currency) => getBalance(currency))),
        getOpenOrders(market),
        getOrderHistory(market),
      ]);

      setBalances(nextBalances);
      setOpenOrders(nextOpenOrders);
      setOrderHistory(nextHistory);

      if (focusOrders) {
        setTab(nextOpenOrders.length ? "Open Orders" : "Order History");
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? err?.message ?? "Dashboard unavailable",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onCancelOrder(orderId: string) {
    await cancelOrder({ market, orderId });
    window.dispatchEvent(new CustomEvent("exchange:orders-changed"));
    await refreshDashboard(true);
  }

  useEffect(() => {
    refreshDashboard();
    const onOrdersChanged = () => refreshDashboard(true);
    window.addEventListener("exchange:orders-changed", onOrdersChanged);
    return () =>
      window.removeEventListener("exchange:orders-changed", onOrdersChanged);
  }, [market, balanceCurrencies.join(",")]);

  useEffect(() => {
    if (tab === "Balances") return;
    const id = window.setInterval(() => refreshDashboard(), 3_000);
    return () => window.clearInterval(id);
  }, [market, tab, balanceCurrencies.join(",")]);

  return (
    <div className="border-t border-[#1a2232] bg-[#0b1019]">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={() => refreshDashboard()}
          className="rounded px-2 py-1 text-xs font-semibold text-[#4c96ff] hover:bg-[#121a28] hover:text-[#72adff]"
        >
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="border-t border-[#131a28] px-3 pt-2 pb-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <div className="text-[#8ea0ba]">
            <span className="mr-2">Dashboard</span>
            <span className="font-semibold text-[#dfe8f6]">
              {totalBalanceLabel}
            </span>
          </div>
          {error && <div className="text-[#e35d66]">{error}</div>}
        </div>

        {tab === "Balances" ? (
          <BalancesPanel balances={balances} />
        ) : tab === "Open Orders" ? (
          <OpenOrdersPanel
            market={market}
            orders={openOrders}
            onCancel={onCancelOrder}
          />
        ) : (
          <OrderHistoryPanel orders={orderHistory} />
        )}
      </div>
    </div>
  );
}

function BalancesPanel({ balances }: { balances: Balance[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#1a2232] bg-[#0f1522]">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] border-b border-[#1a2232] px-3 py-1.5 text-[10px] font-semibold text-[#8ea0ba]">
        <div>Asset</div>
        <div className="text-right">Total</div>
        <div className="text-right">Available</div>
        <div className="text-right">Locked</div>
      </div>
      <div className="max-h-[110px] overflow-y-auto divide-y divide-[#131a28]/60">
        {balances.map((balance) => {
          const meta = ASSET_META[balance.currency] ?? {
            name: balance.currency,
            color: "bg-[#4c5f7a]",
          };
          return (
            <div
              key={balance.currency}
              className="grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-[#09101a] ${meta.color}`}
                >
                  {balance.currency[0]}
                </div>
                <div>
                  <div className="font-semibold leading-tight text-[#dfe8f6]">
                    {meta.name}
                  </div>
                  <div className="text-[10px] text-[#72839e]">
                    {balance.currency}
                  </div>
                </div>
              </div>
              <div className="text-right font-medium tabular-nums text-[#dfe8f6]">
                {formatAmount(balance.available + balance.locked)}
              </div>
              <div className="text-right font-medium tabular-nums text-[#dfe8f6]">
                {formatAmount(balance.available)}
              </div>
              <div className="text-right tabular-nums text-[#8ea0ba]">
                {formatAmount(balance.locked)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpenOrdersPanel({
  market,
  orders,
  onCancel,
}: {
  market: string;
  orders: OpenOrder[];
  onCancel: (orderId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#1a2232] bg-[#0f1522]">
      <div className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_90px] border-b border-[#1a2232] px-3 py-1.5 text-[10px] font-semibold text-[#8ea0ba]">
        <div>{market}</div>
        <div>Side</div>
        <div className="text-right">Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Filled</div>
        <div className="text-right">Action</div>
      </div>
      {orders.length === 0 ? (
        <div className="flex h-[110px] items-center justify-center px-4 text-xs text-[#8295b0]">
          No open orders on this market. Filled orders appear in Order History.
        </div>
      ) : (
        <div className="max-h-[110px] overflow-y-auto divide-y divide-[#131a28]/60">
          {orders.map((order) => (
            <OrderRow
              key={order.orderId}
              order={order}
              action={
                <button
                  type="button"
                  onClick={() => onCancel(order.orderId)}
                  className="text-right text-[#e35d66] hover:text-[#ff7b84]"
                >
                  Cancel
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderHistoryPanel({ orders }: { orders: OrderHistoryItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#1a2232] bg-[#0f1522]">
      <div className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_1fr] border-b border-[#1a2232] px-3 py-1.5 text-[10px] font-semibold text-[#8ea0ba]">
        <div>Order</div>
        <div>Side</div>
        <div className="text-right">Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Filled</div>
        <div className="text-right">Status</div>
      </div>
      {orders.length === 0 ? (
        <div className="flex h-[110px] items-center justify-center px-4 text-xs text-[#8295b0]">
          No orders placed on this market yet.
        </div>
      ) : (
        <div className="max-h-[110px] overflow-y-auto divide-y divide-[#131a28]/60">
          {orders.map((order) => (
            <OrderRow
              key={`${order.orderId}-${order.updatedAt}`}
              order={order}
              action={
                <span className="text-right text-[10px] font-semibold text-[#8ea0ba]">
                  {order.status.replace("_", " ")}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  action,
}: {
  order: OpenOrder | OrderHistoryItem;
  action: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr_1fr_1fr] items-center px-3 py-1.5 text-xs">
      <div className="truncate text-[#8ea0ba]">{order.orderId}</div>
      <div
        className={order.side === "buy" ? "text-[#00d8a0]" : "text-[#e35d66]"}
      >
        {order.side.toUpperCase()}
      </div>
      <div className="text-right font-medium tabular-nums text-[#dfe8f6]">
        {formatPrice(order.price)}
      </div>
      <div className="text-right font-medium tabular-nums text-[#dfe8f6]">
        {formatAmount(order.quantity)}
      </div>
      <div className="text-right tabular-nums text-[#8ea0ba]">
        {formatAmount(order.executedQty)}
      </div>
      <div className="text-right">{action}</div>
    </div>
  );
}
