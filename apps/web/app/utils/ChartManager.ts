import {
  ColorType,
  createChart as createLightWeightChart,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from "lightweight-charts";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  volume?: number;
}

export interface ChartTheme {
  background: string;
  color: string;
  upColor?: string;
  downColor?: string;
  gridColor?: string;
  crosshairColor?: string;
}

export class ChartManager {
  private chart: IChartApi;
  private candleSeries: ISeriesApi<"Candlestick">;
  private volumeSeries: ISeriesApi<"Histogram">;
  private bucketMs: number;
  private lastCandle: Candle | null = null;
  private theme: Required<ChartTheme>;

  constructor(
    ref: HTMLElement,
    initialData: Candle[],
    theme: ChartTheme,
    bucketMs: number,
    _watermark?: string,
  ) {
    this.bucketMs = bucketMs;
    this.theme = {
      background: theme.background,
      color: theme.color,
      upColor: theme.upColor ?? "#26a69a",
      downColor: theme.downColor ?? "#ef5350",
      crosshairColor: theme.crosshairColor ?? "rgba(122, 138, 162, 0.55)",
      gridColor:
        theme.gridColor ??
        (theme.background.toLowerCase() === "#0b0f17"
          ? "rgba(124, 141, 168, 0.14)"
          : "rgba(0,0,0,0.06)"),
    };

    const chart = createLightWeightChart(ref, {
      autoSize: true,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: this.theme.crosshairColor,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#121c2c",
        },
        horzLine: {
          width: 1,
          color: this.theme.crosshairColor,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#121c2c",
        },
      },
      rightPriceScale: {
        visible: true,
        ticksVisible: true,
        entireTextOnly: true,
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.2 },
      },
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: bucketMs < 60_000,
        borderVisible: false,
        rightOffset: 6,
        barSpacing: 7,
        minBarSpacing: 3,
        fixLeftEdge: true,
      },
      grid: {
        horzLines: { color: this.theme.gridColor },
        vertLines: { color: this.theme.gridColor },
      },
      layout: {
        background: { type: ColorType.Solid, color: this.theme.background },
        textColor: this.theme.color,
        fontFamily: "Inter, system-ui, sans-serif",
      },
      watermark: { visible: false, text: "" },
      localization: {
        priceFormatter: (value: number) =>
          value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
    });

    this.chart = chart;

    this.candleSeries = chart.addCandlestickSeries({
      upColor: this.theme.upColor,
      downColor: this.theme.downColor,
      borderUpColor: this.theme.upColor,
      borderDownColor: this.theme.downColor,
      wickUpColor: this.theme.upColor,
      wickDownColor: this.theme.downColor,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dotted,
      priceLineColor: "#1fc7a1",
      lastValueVisible: true,
    });

    this.volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: this.theme.upColor,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.83, bottom: 0.01 },
      borderVisible: false,
    });

    this.setData(initialData);
  }

  public setData(data: Candle[]) {
    const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
    this.candleSeries.setData(
      sorted.map((d) => ({
        time: (d.timestamp / 1000) as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    );
    this.volumeSeries.setData(
      sorted.map((d) => ({
        time: (d.timestamp / 1000) as UTCTimestamp,
        value: d.volume ?? 0,
        color:
          d.close >= d.open ? "rgba(31,199,161,0.40)" : "rgba(227,93,102,0.40)",
      })),
    );
    this.lastCandle = sorted.length ? { ...sorted[sorted.length - 1]! } : null;
    this.chart.timeScale().fitContent();
  }

  public updatePrice(
    price: number,
    quantity: number = 0,
    now: number = Date.now(),
  ) {
    if (!isFinite(price) || price <= 0) return;
    const bucket = Math.floor(now / this.bucketMs) * this.bucketMs;

    if (!this.lastCandle || bucket > this.lastCandle.timestamp) {
      const open = this.lastCandle ? this.lastCandle.close : price;
      this.lastCandle = {
        timestamp: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        volume: quantity,
      };
    } else {
      this.lastCandle.close = price;
      if (price > this.lastCandle.high) this.lastCandle.high = price;
      if (price < this.lastCandle.low) this.lastCandle.low = price;
      this.lastCandle.volume = (this.lastCandle.volume ?? 0) + quantity;
    }

    const t = (this.lastCandle.timestamp / 1000) as UTCTimestamp;
    this.candleSeries.update({
      time: t,
      open: this.lastCandle.open,
      high: this.lastCandle.high,
      low: this.lastCandle.low,
      close: this.lastCandle.close,
    });
    this.volumeSeries.update({
      time: t,
      value: this.lastCandle.volume ?? 0,
      color:
        this.lastCandle.close >= this.lastCandle.open
          ? "rgba(31,199,161,0.40)"
          : "rgba(227,93,102,0.40)",
    });
  }

  public mergeData(data: Candle[]) {
    if (!data.length) return;
    this.setData(data);
  }

  public setBucketMs(bucketMs: number) {
    this.bucketMs = bucketMs;
    this.chart.applyOptions({
      timeScale: { secondsVisible: bucketMs < 60_000 },
    });
  }

  public fit() {
    this.chart.timeScale().fitContent();
  }

  public destroy() {
    this.chart.remove();
  }
}
