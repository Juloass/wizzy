import { DEFAULT_MAX_PLAYERS } from "@wizzy/shared";
import express, { Request, Response } from "express";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { Socket, Server as SocketIOServer } from "socket.io";

// ⚠️ En prod, garde cette clé secrète et utilise plutôt la lib officielle Twitch pour la valider côté serveur
const TWITCH_EXTENSION_SECRET = process.env.TWITCH_EXTENSION_SECRET;
if (!TWITCH_EXTENSION_SECRET) {
  throw new Error("Missing TWITCH_EXTENSION_SECRET environment variable");
}

// Initialize Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).send("OK");
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize WebSocket server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      "https://*.twitch.tv",
      "https://*.twitchcdn.net",
      "*", // 🔥 à retirer en production
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware pour authentifier le socket avec le token Twitch
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.warn("❌ Socket connection without token");
    return next(new Error("Authentication token missing"));
  }

  try {
    const decoded = jwt.verify(token, TWITCH_EXTENSION_SECRET);
    socket.data.twitchUser = decoded;
    next();
  } catch (err) {
    console.error("❌ Invalid Twitch token", err);
    next(new Error("Invalid token"));
  }
});

// Socket.io connection handler
io.on("connection", (socket: Socket) => {
  const twitchUser = socket.data.twitchUser;
  console.log(`🔌 New Twitch viewer connected: ${socket.id}`);
  console.log(
    `🧑 Viewer identity: ${twitchUser?.opaque_user_id || "Anonymous"}`
  );
  console.log(`🎮 Max players allowed: ${DEFAULT_MAX_PLAYERS}`);

  socket.on("join", (data: { playerName: string }) => {
    console.log("👥 Player joined:", data.playerName);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
