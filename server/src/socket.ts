import { Server as SocketIOServer, Socket } from "socket.io";
import { authenticateStreamer, authenticateViewer } from "./auth";
import { lobbyManager } from "./lobbyManager";
import { ViewerInLobby, LobbyState } from "./types";
import {
  CreateLobbyPayload,
  LobbyCreatedPayload,
  JoinLobbyPayload,
  LobbyJoinedPayload,
  StartQuestionPayload,
  QuestionStartedPayload,
  SubmitAnswerPayload,
  AnswerRevealPayload,
  QuestionRecapPayload,
  ScoreUpdatePayload,
  EndQuizPayload,
  QuizEndedPayload,
  ErrorPayload,
  ScoreEntry,
} from "@wizzy/shared";

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

  socket.on(
    "create_lobby",
    async (payload: CreateLobbyPayload) => {
    try {
      const lobby = await lobbyManager.createLobby(
        userId,
        socket.id,
        payload.quizId,
        payload.config
      );
      socket.join(lobby.id);
      const msg: LobbyCreatedPayload = { lobbyId: lobby.id };
      socket.emit("lobby_created", msg);
    } catch (err) {
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  }
  );

  socket.on("start_question", async (payload: StartQuestionPayload) => {
    try {
      const q = lobbyManager.startQuestion(payload.lobbyId);
      const lobby = lobbyManager.getLobby(payload.lobbyId)!;
      const qMsg: QuestionStartedPayload = {
        id: q.id,
        text: q.text,
        choices: q.choices.map((c) => ({ index: c.index, text: c.text })),
        audioPromptKey: q.audioPromptKey,
      };
      io.to(payload.lobbyId).emit("question_started", qMsg);

      lobby.questionTimer = setTimeout(() => {
        const result = lobbyManager.revealAnswer(payload.lobbyId);
        broadcastQuestionResults(io, lobby, result);
      }, lobby.config.questionDuration * 1000);
    } catch (err) {
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("reveal_answer", (payload: StartQuestionPayload) => {
    try {
      const lobby = lobbyManager.getLobby(payload.lobbyId)!;
      const result = lobbyManager.revealAnswer(payload.lobbyId);
      broadcastQuestionResults(io, lobby, result);
    } catch (err) {
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("end_quiz", async (payload: EndQuizPayload) => {
    try {
      const results = await lobbyManager.endQuiz(payload.lobbyId);
      const msg: QuizEndedPayload = { results };
      io.to(payload.lobbyId).emit("quiz_ended", msg);
    } catch (err) {
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("disconnect", () => {
    lobbyManager.removeLobbiesByHost(userId);
  });
}

function handleViewer(io: SocketIOServer, socket: Socket) {
  const auth = socket.data.viewerInfo as ViewerInLobby;

  socket.on("join_lobby", (payload: JoinLobbyPayload) => {
    try {
      lobbyManager.joinLobby(payload.lobbyId, { ...auth, socketId: socket.id });
      socket.join(payload.lobbyId);
      const msg: LobbyJoinedPayload = { lobbyId: payload.lobbyId };
      socket.emit("lobby_joined", msg);
    } catch (err) {
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("submit_answer", (payload: SubmitAnswerPayload) => {
    try {
      lobbyManager.submitAnswer(payload.lobbyId, auth.id, payload.choiceIndex);
    } catch (err) {
      const errMsg: ErrorPayload = { message: (err as Error).message };
      socket.emit("error", errMsg);
    }
  });

  socket.on("disconnect", () => {
    lobbyManager.removeViewerEverywhere(auth.id);
  });
}

function broadcastQuestionResults(
  io: SocketIOServer,
  lobby: LobbyState,
  result: { correct: number; stats: Map<number, number>; scoreboard: ScoreEntry[] }
) {
  const revealMsg: AnswerRevealPayload = {
    correct: result.correct,
    stats: Array.from(result.stats.entries()),
  };
  io.to(lobby.id).emit("answer_reveal", revealMsg);

  // send recap to streamer
  const recapMsg: QuestionRecapPayload = {
    questionId: lobby.quiz.questions[lobby.currentQuestion].id,
    correct: result.correct,
    stats: Array.from(result.stats.entries()),
    scoreboard: result.scoreboard,
  };
  io.to(lobby.hostSocketId).emit("question_recap", recapMsg);

  for (const viewer of lobby.viewers.values()) {
    const rank =
      result.scoreboard.findIndex((s) => s.viewerId === viewer.id) + 1;
    const score = lobby.scores.get(viewer.id) || 0;
    let top: ScoreEntry[] = [];
    if (rank <= 3) {
      top = result.scoreboard.slice(0, 3);
    } else {
      top = [result.scoreboard[0], result.scoreboard[1], { viewerId: viewer.id, score }];
    }
    const payload: ScoreUpdatePayload = { score, rank, top };
    io.to(viewer.socketId).emit("score_update", payload);
  }
}
