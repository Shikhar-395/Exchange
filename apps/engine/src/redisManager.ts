import { createClient, RedisClientType } from "redis";
import { DbMessage } from "@repo/common/dbMessages";
import { WsMessage } from "@repo/common/wsMessages";
import { MessageFromEngine } from "@repo/common/engineMessages";

// to not accidentally create multiple connections to redis
export class RedisManager {
  private client: RedisClientType;
  private static instance: RedisManager;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    this.client.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public pushMessage(message: DbMessage) {
    this.client.lPush("db_processor", JSON.stringify(message));
  }

  public publishMessage(channel: string, message: WsMessage) {
    this.client.publish(channel, JSON.stringify(message));
  }

  public sendToApi(clientId: string, message: MessageFromEngine) {
    this.client.publish(clientId, JSON.stringify(message));
  }
}
