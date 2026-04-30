import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3002 });

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (data) => {});
});
