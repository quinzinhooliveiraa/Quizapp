import http from "http";
import app from "./app";
import { attachLobbyServer } from "./lib/lobbyServer";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);
attachLobbyServer(httpServer);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening");
    process.exit(1);
  }

  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});
