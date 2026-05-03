export const AskTable = ({ asks }: { asks: [string, string][] }) => {
  let currentTotal = 0;
  const relevantAsks = asks.slice(0, 14);
  const asksWithTotal: [string, string, number][] = relevantAsks.map(
    ([price, quantity]) => [
      price,
      quantity,
      (currentTotal += Number(quantity)),
    ],
  );
  const maxTotal = currentTotal;
  asksWithTotal.reverse();

  return (
    <div>
      {asksWithTotal.map(([price, quantity, total]) => (
        <Ask
          maxTotal={maxTotal}
          key={price}
          price={price}
          quantity={quantity}
          total={total}
        />
      ))}
    </div>
  );
};

function Ask({
  price,
  quantity,
  total,
  maxTotal,
}: {
  price: string;
  quantity: string;
  total: number;
  maxTotal: number;
}) {
  const widthPercent = maxTotal > 0 ? (100 * total) / maxTotal : 0;

  return (
    <div className="relative my-[2px] flex h-[20px] w-full overflow-hidden rounded-[2px] bg-transparent">
      <div
        className="absolute right-0 top-0 h-full bg-[#5a212a]/80 transition-[width] duration-300 ease-in-out"
        style={{ width: `${widthPercent}%` }}
      />
      <div className="relative z-10 grid h-full w-full grid-cols-[1.2fr_1fr_1fr] items-center px-1.5 text-[13px] leading-none font-semibold tracking-tight">
        <div className="text-[#e35d66]">
          {Number(price).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div className="text-right text-[#e3e9f3]">
          {Number(quantity).toFixed(3)}
        </div>
        <div className="text-right text-[#e3e9f3]">{total.toFixed(2)}</div>
      </div>
    </div>
  );
}
