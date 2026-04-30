import { WebSocket } from "ws";
import { OutgoingMessage } from "./types/out";
import { IncomingMessage, SUBSCRIBE, UNSUBSCRIBE } from "./types/in";
import { SubscriptionManager } from "./subscriptionManager";
export class User {
  private id: string;
  private ws: WebSocket;
  private subscriptions: string[] = [];

  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
    this.addListeners();
  }

  public subscribe(subscription: string) {
    this.subscriptions.push(subscription);
  }

  public unsubscribe(unsubscribe: string) {
    this.subscriptions = this.subscriptions.filter((x) => x != unsubscribe);
  }

  emit(message: OutgoingMessage) {
    this.ws.send(JSON.stringify(message));
  }

  private addListeners() {
    this.ws.on("message", (message: string) => {
      const parsedMessage: IncomingMessage = JSON.parse(message);
      if (parsedMessage.method == SUBSCRIBE) {
        parsedMessage.params.forEach((s) =>
          SubscriptionManager.getInstance().subscribe(this.id, s),
        );
      }
      if (parsedMessage.method == UNSUBSCRIBE) {
        //  it should be as above only , remember while testing
        parsedMessage.params.forEach((s) =>
          SubscriptionManager.getInstance().unSubscribe(
            this.id,
            parsedMessage.params[0]!,
          ),
        );
      }
    });
  }
}
