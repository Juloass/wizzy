import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { initSocket } from "./socket";

dotenv.config();

export function createApp(): {
  app: express.Express;
  httpServer: ReturnType<typeof createServer>;
  io: SocketIOServer;
} {
  const app = express();
  app.get("/health", function (_req, res) {
    res.send("OK");
  });

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ["https://*.twitch.tv", "https://*.twitchcdn.net", "*"],
      methods: ["GET", "POST"],
    },
  });

  initSocket(io);

  return { app, httpServer, io };
}

if (require.main === module) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
  const { httpServer } = createApp();
  httpServer.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
}
