import { Server as SocketIOServer, Socket } from "socket.io";
import { authenticateStreamer, authenticateViewer } from "./auth";
import { lobbyManager } from "./lobbyManager";
import { ViewerInLobby } from "./types";

export function initSocket(io: SocketIOServer) {
  io.use(async (socket, next) => {
    try {
      const role = socket.handshake.auth?.role as string | undefined;
      if (role === "streamer") {
        const accessToken = socket.handshake.auth?.accessToken;
        const auth = await authenticateStreamer(accessToken);
        socket.data.userId = auth.userId;
        socket.data.role = "streamer";
      } else {
        const token = socket.handshake.auth?.token;
        const auth = await authenticateViewer(token);
        socket.data.userId = auth.id;
        socket.data.role = "viewer";
        socket.data.viewerInfo = auth;
      }
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error("Auth failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const role = socket.data.role as string;
    if (role === "streamer") {
      handleStreamer(io, socket);
    } else {
      handleViewer(io, socket);
    }
  });
}

function handleStreamer(io: SocketIOServer, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("create_lobby", async (payload: { quizId: string; config?: { maxPlayers?: number } }) => {
    try {
      const lobby = await lobbyManager.createLobby(userId, payload.quizId, payload.config);
      socket.join(lobby.id);
      socket.emit("lobby_created", { lobbyId: lobby.id });
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  socket.on("start_question", async (payload: { lobbyId: string }) => {
    try {
      const q = lobbyManager.startQuestion(payload.lobbyId);
      io.to(payload.lobbyId).emit("question_started", {
        id: q.id,
        text: q.text,
        choices: q.choices.map((c) => ({ index: c.index, text: c.text })),
        audioPromptKey: q.audioPromptKey,
      });
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  socket.on("reveal_answer", (payload: { lobbyId: string }) => {
    try {
      const result = lobbyManager.revealAnswer(payload.lobbyId);
      io.to(payload.lobbyId).emit("answer_reveal", {
        correct: result.correct,
        stats: Array.from(result.stats.entries()),
      });
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  socket.on("end_quiz", async (payload: { lobbyId: string }) => {
    try {
      const results = await lobbyManager.endQuiz(payload.lobbyId);
      io.to(payload.lobbyId).emit("quiz_ended", { results });
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  socket.on("disconnect", () => {
    lobbyManager.removeLobbiesByHost(userId);
  });
}

function handleViewer(io: SocketIOServer, socket: Socket) {
  const auth = socket.data.viewerInfo as ViewerInLobby;

  socket.on("join_lobby", (payload: { lobbyId: string }) => {
    try {
      lobbyManager.joinLobby(payload.lobbyId, { ...auth, socketId: socket.id });
      socket.join(payload.lobbyId);
      socket.emit("lobby_joined", { lobbyId: payload.lobbyId });
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  socket.on("submit_answer", (payload: { lobbyId: string; choiceIndex: number }) => {
    try {
      lobbyManager.submitAnswer(payload.lobbyId, auth.id, payload.choiceIndex);
    } catch (err) {
      socket.emit("error", { message: (err as Error).message });
    }
  });

  socket.on("disconnect", () => {
    lobbyManager.removeViewerEverywhere(auth.id);
  });
}
