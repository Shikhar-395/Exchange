import { createClient, RedisClientType } from "redis";
import { randomUUID } from "crypto";
import { MessageToEngine } from "@repo/common/engineMessages";
import { MessageFromEngine } from "@repo/common/engineMessages";

// to not accidentally create multiple connections to redis
export class RedisManager {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private static instance: RedisManager;

  private constructor() {
    this.client = createClient();
    this.publisher = createClient();
  }

  public static async connect() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    await this.instance.client.connect();
    await this.instance.publisher.connect();
    return this.instance;
  }

  public static getInstance() {
    if (!this.instance) {
      throw new Error(
        "RedisManager not connected. Call RedisManager.connect() first.",
      );
    }
    return this.instance;
  }

  public sendAndAwait(message: MessageToEngine): Promise<MessageFromEngine> {
    return new Promise<MessageFromEngine>((resolve) => {
      const id = randomUUID();
      this.client.subscribe(id, (msg) => {
        this.client.unsubscribe(id);
        resolve(JSON.parse(msg));
      });
      this.publisher.lPush(
        "messages",
        JSON.stringify({ clientId: id, message }),
      );
    });
  }
}
