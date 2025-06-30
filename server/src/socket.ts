import {
  AnswerRevealPayload,
  CreateLobbyPayload,
  EndQuizPayload,
  ErrorPayload,
  JoinLobbyPayload,
  LobbyCreatedPayload,
  LobbyFullPayload,
  LobbyJoinedPayload,
  QuestionRecapPayload,
  QuestionStartedPayload,
  QuizEndedPayload,
  ScoreEntry,
  ScoreUpdatePayload,
  SocketDirection,
  SocketEventDefinition,
  StartQuestionPayload,
  SubmitAnswerPayload,
} from "@wizzy/shared";
import { Socket, Server as SocketIOServer } from "socket.io";
import { authenticateStreamer, authenticateViewer } from "./auth";
import { lobbyManager } from "./lobbyManager";
import { LobbyState, ViewerInLobby } from "./types";

type EventsByDirection<D extends SocketDirection> = {
  [K in keyof SocketEventDefinition as D extends SocketEventDefinition[K]["direction"]
    ? K
    : never]: (payload: SocketEventDefinition[K]["payload"]) => void;
};

type ClientToServerEvents = EventsByDirection<"viewer->server"> &
  EventsByDirection<"web->server">;
type ServerToClientEvents = EventsByDirection<"server->viewer"> &
  EventsByDirection<"server->web">;

export function initSocket(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
) {
  io.use(async (socket, next) => {
    try {
      const role = socket.handshake.auth?.role as string | undefined;
      console.log("[AUTH] Incoming connection with role:", role);

      if (role === "streamer") {
        const accessToken = socket.handshake.auth?.accessToken;
        console.log("[AUTH] Streamer accessToken:", accessToken);
        const auth = await authenticateStreamer(accessToken);
        console.log("[AUTH] Streamer authenticated:", auth);
        socket.data.userId = auth.userId;
        socket.data.role = "streamer";
      } else {
        const token = socket.handshake.auth?.token;
        console.log("[AUTH] Viewer token:", token);
        const auth = await authenticateViewer(token);
        console.log("[AUTH] Viewer authenticated:", auth);
        socket.data.userId = auth.id;
        socket.data.role = "viewer";
        socket.data.viewerInfo = auth;
      }

      next();
    } catch (err) {
      console.error("[AUTH ERROR]", err);
      next(err instanceof Error ? err : new Error("Auth failed"));
    }
  });

  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      console.log("[CONNECTION] User connected:", socket.id);
      console.log("[CONNECTION] User data:", socket.data);

      const role = socket.data.role as string;
      console.log("[CONNECTION] User role:", role);

      if (role === "streamer") {
        handleStreamer(io, socket);
      } else {
        handleViewer(io, socket);
      }
    }
  );
}

function handleStreamer(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) {
  const userId = socket.data.userId as string;
  console.log(`[STREAMER] Handling streamer: ${userId} on socket ${socket.id}`);

  const COUNTDOWN_MS = process.env.QUIZ_COUNTDOWN_MS
    ? Number(process.env.QUIZ_COUNTDOWN_MS)
    : 10000;

  lobbyManager.handleHostReconnect(userId, socket.id);
  console.log(`[STREAMER] Host reconnected in lobbyManager`);

  socket.on("create_lobby", async (payload: CreateLobbyPayload) => {
    console.log("[EVENT] create_lobby:", payload);
    try {
      const lobby = await lobbyManager.createLobby(
        userId,
        socket.id,
        payload.quizId,
        payload.config
      );
      console.log("[LOBBY] Created lobby:", lobby.id);
      socket.join(lobby.id);
      const msg: LobbyCreatedPayload = { lobbyId: lobby.id };
      socket.emit("lobby_created", msg);
      console.log("[EMIT] lobby_created:", msg);
    } catch (err) {
      console.error("[ERROR] create_lobby:", err);
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("start_question", async (payload: StartQuestionPayload) => {
    console.log("[EVENT] start_question:", payload);
    try {
      const lobby = lobbyManager.getLobby(payload.lobbyId)!;
      if (lobby.countdownTimer) {
        clearTimeout(lobby.countdownTimer);
        console.log("[COUNTDOWN] Existing countdown cleared");
      }

      if (COUNTDOWN_MS > 0) {
        io.to(payload.lobbyId).emit("question_countdown", {
          duration: COUNTDOWN_MS / 1000,
        });
        console.log("[EMIT] question_countdown", {
          duration: COUNTDOWN_MS / 1000,
        });
      }

      const startFn = () => {
        lobby.countdownTimer = undefined;
        const q = lobbyManager.startQuestion(payload.lobbyId);
        console.log("[QUESTION] Started:", q.id);

        const qMsg: QuestionStartedPayload = {
          id: q.id,
          text: q.text,
          choices: q.choices.map((c) => ({ index: c.index, text: c.text })),
          audioPromptKey: q.audioPromptKey,
          imageKey: q.imageKey,
        };

        io.to(payload.lobbyId).emit("question_started", qMsg);
        console.log("[EMIT] question_started", qMsg);

        lobby.questionTimer = setTimeout(() => {
          const result = lobbyManager.revealAnswer(payload.lobbyId);
          broadcastQuestionResults(io, lobby, result);
        }, lobby.config.questionDuration * 1000);
      };

      if (COUNTDOWN_MS > 0) {
        lobby.countdownTimer = setTimeout(startFn, COUNTDOWN_MS);
        console.log("[COUNTDOWN] Started:", COUNTDOWN_MS, "ms");
      } else {
        startFn();
      }
    } catch (err) {
      console.error("[ERROR] start_question:", err);
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("reveal_answer", (payload: StartQuestionPayload) => {
    console.log("[EVENT] reveal_answer:", payload);
    try {
      const lobby = lobbyManager.getLobby(payload.lobbyId)!;
      if (lobby.countdownTimer) {
        clearTimeout(lobby.countdownTimer);
        lobby.countdownTimer = undefined;
        console.log("[COUNTDOWN] Cleared for reveal");
      }
      const result = lobbyManager.revealAnswer(payload.lobbyId);
      console.log("[ANSWER] Reveal result:", result);
      broadcastQuestionResults(io, lobby, result);
    } catch (err) {
      console.error("[ERROR] reveal_answer:", err);
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("end_quiz", async (payload: EndQuizPayload) => {
    console.log("[EVENT] end_quiz:", payload);
    try {
      const lobby = lobbyManager.getLobby(payload.lobbyId);
      if (lobby?.countdownTimer) {
        clearTimeout(lobby.countdownTimer);
        lobby.countdownTimer = undefined;
        console.log("[COUNTDOWN] Cleared on end_quiz");
      }
      const results = await lobbyManager.endQuiz(payload.lobbyId);
      const msg: QuizEndedPayload = { results };
      io.to(payload.lobbyId).emit("quiz_ended", msg);
      console.log("[EMIT] quiz_ended", msg);
    } catch (err) {
      console.error("[ERROR] end_quiz:", err);
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("disconnect", () => {
    console.log("[DISCONNECT] Streamer:", userId, socket.id);
    lobbyManager.handleHostDisconnect(io, userId);
  });
}

function handleViewer(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) {
  const auth = socket.data.viewerInfo as ViewerInLobby;
  console.log(`[VIEWER] Connected: ${auth.id} (${socket.id})`);

  socket.on("join_lobby", (payload: JoinLobbyPayload) => {
    console.log("[EVENT] join_lobby:", payload);
    try {
      const lobby = lobbyManager.getLobby(payload.lobbyId);
      if (!lobby) {
        throw new Error("Lobby not found");
      }

      if (lobby.viewers.size >= lobby.config.maxPlayers) {
        console.log("[LOBBY] Full:", lobby.id);
        const fullMsg: LobbyFullPayload = { lobbyId: payload.lobbyId };
        socket.emit("lobby_full", fullMsg);
        return;
      }

      lobbyManager.joinLobby(payload.lobbyId, { ...auth, socketId: socket.id });
      socket.join(payload.lobbyId);
      console.log(`[LOBBY] Viewer joined lobby: ${lobby.id}`);

      const msg: LobbyJoinedPayload = { lobbyId: payload.lobbyId };
      socket.emit("lobby_joined", msg);
      console.log("[EMIT] lobby_joined", msg);

      const hostId = lobby.hostSocketId;
      if (hostId) {
        io.to(hostId).emit("join", {
          player: {
            id: auth.id,
            displayName: auth.displayName,
            imageUrl: auth.profileImageUrl,
          },
        });
        console.log("[EMIT] join to host", { player: auth });
      }

      const lobbyState = lobbyManager.getLobby(payload.lobbyId);
      if (
        lobbyState &&
        lobbyState.currentQuestion >= 0 &&
        lobbyState.questionStartedAt
      ) {
        const q = lobbyState.quiz.questions[lobbyState.currentQuestion];
        const endsAt =
          lobbyState.questionStartedAt +
          lobbyState.config.questionDuration * 1000;
        const remaining = Math.max(0, (endsAt - Date.now()) / 1000);
        const qMsg: QuestionStartedPayload = {
          id: q.id,
          text: q.text,
          choices: q.choices.map((c) => ({ index: c.index, text: c.text })),
          audioPromptKey: q.audioPromptKey,
          imageKey: q.imageKey,
          remaining,
        };
        socket.emit("question_started", qMsg);
        console.log("[EMIT] question_started (catch-up)", qMsg);
      }
    } catch (err) {
      console.error("[ERROR] join_lobby:", err);
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("submit_answer", (payload: SubmitAnswerPayload) => {
    console.log("[EVENT] submit_answer:", payload);
    try {
      lobbyManager.submitAnswer(payload.lobbyId, auth.id, payload.choiceIndex);
      console.log("[ANSWER] Submitted:", payload);
    } catch (err) {
      console.error("[ERROR] submit_answer:", err);
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("disconnect", () => {
    console.log("[DISCONNECT] Viewer:", auth.id, socket.id);
    lobbyManager.removeViewerEverywhere(auth.id);
  });
}

function broadcastQuestionResults(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  lobby: LobbyState,
  result: {
    correct: number;
    stats: Map<number, number>;
    scoreboard: ScoreEntry[];
  }
) {
  console.log("[BROADCAST] Question results:", result);

  const revealMsg: AnswerRevealPayload = {
    correct: result.correct,
    stats: Array.from(result.stats.entries()),
  };
  io.to(lobby.id).emit("answer_reveal", revealMsg);
  console.log("[EMIT] answer_reveal", revealMsg);

  const recapMsg: QuestionRecapPayload = {
    questionId: lobby.quiz.questions[lobby.currentQuestion].id,
    correct: result.correct,
    stats: Array.from(result.stats.entries()),
    scoreboard: result.scoreboard,
  };

  if (lobby.hostSocketId) {
    io.to(lobby.hostSocketId).emit("question_recap", recapMsg);
    console.log("[EMIT] question_recap to host", recapMsg);
  }

  for (const viewer of lobby.viewers.values()) {
    const rank =
      result.scoreboard.findIndex((s) => s.viewerId === viewer.id) + 1;
    const score = lobby.scores.get(viewer.id) || 0;
    let top: ScoreEntry[] = [];
    if (rank <= 3) {
      top = result.scoreboard.slice(0, 3);
    } else {
      top = [
        result.scoreboard[0],
        result.scoreboard[1],
        { viewerId: viewer.id, score },
      ];
    }

    const payload: ScoreUpdatePayload = { score, rank, top };
    io.to(viewer.socketId).emit("score_update", payload);
    console.log(`[EMIT] score_update to viewer ${viewer.id}`, payload);
  }
}
