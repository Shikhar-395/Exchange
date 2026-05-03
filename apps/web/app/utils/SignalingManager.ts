import { Ticker } from "./types";

export const BASE_URL =
  process.env.NEXT_PUBLIC_EXCHANGE_WS_URL ?? "ws://localhost:3002";

type Callback = { callback: (data: any) => void; id: string };

export class SignalingManager {
  private ws: WebSocket;
  private static instance: SignalingManager;
  private bufferedMessages: any[] = [];
  private callbacks: Record<string, Callback[]> = {};
  private subscriptions: Record<string, number> = {};
  private id: number;
  private initialized: boolean = false;

  private constructor() {
    this.ws = new WebSocket(BASE_URL);
    this.bufferedMessages = [];
    this.id = 1;
    this.init();
  }

  public static getInstance() {
    if (!this.instance) this.instance = new SignalingManager();
    return this.instance;
  }

  init() {
    this.ws.onopen = () => {
      this.initialized = true;
      this.bufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.bufferedMessages = [];
      Object.keys(this.subscriptions).forEach((stream) => {
        this.ws.send(
          JSON.stringify({
            method: "SUBSCRIBE",
            params: [stream],
            id: this.id++,
          }),
        );
      });
    };
    this.ws.onclose = () => {
      this.initialized = false;
      setTimeout(() => {
        this.ws = new WebSocket(BASE_URL);
        this.init();
      }, 1000);
    };
    this.ws.onerror = () => {
      try {
        this.ws.close();
      } catch (e) {}
    };
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const type = message.data.e;
      if (this.callbacks[type]) {
        this.callbacks[type].forEach(({ callback }) => {
          if (type === "ticker") {
            const newTicker: Partial<Ticker> = {
              lastPrice: message.data.c,
              high: message.data.h,
              low: message.data.l,
              volume: message.data.v,
              quoteVolume: message.data.V,
              symbol: message.data.s,
            };
            callback(newTicker);
          }
          if (type === "depth") {
            callback({ bids: message.data.b, asks: message.data.a });
          }
          if (type === "trade") {
            callback({
              price: message.data.p,
              quantity: message.data.q,
              tradeId: message.data.t,
              isBuyerMaker: message.data.m,
              symbol: message.data.s,
            });
          }
        });
      }
    };
  }

  sendMessage(message: any) {
    const messageToSend = { ...message, id: this.id++ };
    if (message.method === "SUBSCRIBE" && Array.isArray(message.params)) {
      for (const p of message.params) {
        this.subscriptions[p] = (this.subscriptions[p] ?? 0) + 1;
      }
    }
    if (message.method === "UNSUBSCRIBE" && Array.isArray(message.params)) {
      for (const p of message.params) {
        const c = (this.subscriptions[p] ?? 0) - 1;
        if (c <= 0) delete this.subscriptions[p];
        else this.subscriptions[p] = c;
      }
    }
    if (!this.initialized) {
      this.bufferedMessages.push(messageToSend);
      return;
    }
    this.ws.send(JSON.stringify(messageToSend));
  }

  registerCallback(type: string, callback: (data: any) => void, id: string) {
    this.callbacks[type] = this.callbacks[type] || [];
    this.callbacks[type].push({ callback, id });
  }

  deRegisterCallback(type: string, id: string) {
    const list = this.callbacks[type];
    if (!list) return;
    const index = list.findIndex((c) => c.id === id);
    if (index !== -1) list.splice(index, 1);
  }
}
