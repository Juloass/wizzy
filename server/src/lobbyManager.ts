import { prisma } from "./lib/prisma";
import {
  DEFAULT_MAX_PLAYERS,
  DEFAULT_QUESTION_DURATION,
  MAXIMUM_MAX_PLAYERS,
  MAXIMUM_QUESTION_DURATION,
} from "@wizzy/shared";
import { Server as SocketIOServer } from "socket.io";
import {
  LobbyConfig,
  LobbyState,
  ViewerInLobby,
  QuizWithQuestions,
  QuizEndResult,
} from "./types";
import { QuizEndedPayload } from "@wizzy/shared";
import { randomUUID } from "crypto";

class LobbyManager {
  private lobbies = new Map<string, LobbyState>();

  async createLobby(
    hostId: string,
    hostSocketId: string,
    quizId: string,
    config?: Partial<LobbyConfig>
  ): Promise<LobbyState> {
    console.log("[LOBBY] createLobby called with:", { hostId, quizId, config });

    // 1️⃣ Vérifier si le quiz existe
    const quizRaw = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        owner: true,
        questions: {
          include: { choices: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!quizRaw) {
      console.error(`[LOBBY] Quiz not found: quizId=${quizId}`);
      throw new Error("Quiz not found");
    }

    console.log(
      "[LOBBY] Quiz exists:",
      quizRaw.id,
      "Owned by:",
      quizRaw.owner?.twitchId
    );

    // 2️⃣ Vérifier ownership
    if (quizRaw.owner?.twitchId !== hostId) {
      console.error(
        `[LOBBY] Quiz not owned by streamer: quizId=${quizId}, ownerId=${quizRaw.owner?.twitchId}, hostId=${hostId}`
      );
      throw new Error("Quiz not owned by streamer");
    }

    console.log("[LOBBY] Quiz ownership verified");

    // Validate config
    const qDuration = config?.questionDuration ?? DEFAULT_QUESTION_DURATION;
    if (
      config?.questionDuration !== undefined &&
      (typeof config.questionDuration !== "number" ||
        !isFinite(config.questionDuration) ||
        config.questionDuration <= 0 ||
        config.questionDuration > MAXIMUM_QUESTION_DURATION)
    ) {
      console.error(
        "[LOBBY] Invalid questionDuration:",
        config.questionDuration
      );
      throw new Error("Invalid questionDuration");
    }

    const maxPlayers = config?.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    if (
      config?.maxPlayers !== undefined &&
      (typeof config.maxPlayers !== "number" ||
        !Number.isInteger(config.maxPlayers) ||
        config.maxPlayers <= 0 ||
        config.maxPlayers > MAXIMUM_MAX_PLAYERS)
    ) {
      console.error("[LOBBY] Invalid maxPlayers:", config.maxPlayers);
      throw new Error("Invalid maxPlayers");
    }

    // Create lobby
    const lobbyId = randomUUID();
    console.log("[LOBBY] Generated lobbyId:", lobbyId);

    const lobby: LobbyState = {
      id: lobbyId,
      hostId,
      hostSocketId,
      quiz: quizRaw as QuizWithQuestions,
      config: {
        maxPlayers,
        questionDuration: qDuration,
      },
      viewers: new Map(),
      participants: new Map(),
      scores: new Map(),
      currentQuestion: -1,
      answers: new Map(),
    };

    this.lobbies.set(lobbyId, lobby);
    console.log("[LOBBY] Lobby created and registered:", lobbyId);
    return lobby;
  }

  getLobby(id: string): LobbyState | undefined {
    console.log("[LOBBY] getLobby called:", id);
    return this.lobbies.get(id);
  }

  removeLobby(id: string) {
    console.log("[LOBBY] removeLobby called:", id);
    const lobby = this.lobbies.get(id);
    if (lobby?.questionTimer) {
      clearTimeout(lobby.questionTimer);
      console.log("[LOBBY] Cleared question timer for:", id);
    }
    this.lobbies.delete(id);
  }

  joinLobby(lobbyId: string, viewer: ViewerInLobby): boolean {
    console.log("[LOBBY] joinLobby called:", { lobbyId, viewerId: viewer.id });
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    if (lobby.viewers.size >= lobby.config.maxPlayers) {
      console.warn("[LOBBY] Lobby is full:", lobbyId);
      return false;
    }

    lobby.viewers.set(viewer.id, viewer);
    lobby.participants.set(viewer.id, viewer);
    if (!lobby.scores.has(viewer.id)) {
      lobby.scores.set(viewer.id, 0);
    }

    console.log("[LOBBY] Viewer joined:", viewer.id, "in lobby:", lobbyId);
    return true;
  }

  removeViewer(lobbyId: string, viewerId: string) {
    console.log("[LOBBY] removeViewer called:", { lobbyId, viewerId });
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    lobby.viewers.delete(viewerId);

    if (lobby.viewers.size === 0 && lobby.currentQuestion === -1) {
      console.log("[LOBBY] Lobby is now empty and inactive:", lobbyId);
      // optional cleanup logic
    }
  }

  startQuestion(lobbyId: string) {
    console.log("[LOBBY] startQuestion called:", lobbyId);
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    if (lobby.questionTimer) {
      clearTimeout(lobby.questionTimer);
      lobby.questionTimer = undefined;
      console.log("[LOBBY] Cleared existing question timer");
    }

    lobby.currentQuestion++;
    console.log("[LOBBY] Moving to question index:", lobby.currentQuestion);

    const q = lobby.quiz.questions[lobby.currentQuestion];
    if (!q) throw new Error("No more questions");

    lobby.answers.set(q.id, new Map());
    lobby.questionStartedAt = Date.now();
    console.log("[LOBBY] Question started:", q.id);
    return q;
  }

  submitAnswer(lobbyId: string, viewerId: string, choiceIndex: number) {
    console.log("[LOBBY] submitAnswer called:", {
      lobbyId,
      viewerId,
      choiceIndex,
    });
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    const question = lobby.quiz.questions[lobby.currentQuestion];
    if (!question) throw new Error("Question not started");

    const aMap = lobby.answers.get(question.id);
    if (!aMap) throw new Error("Question state missing");

    aMap.set(viewerId, choiceIndex);
    console.log("[LOBBY] Answer recorded:", { viewerId, choiceIndex });
  }

  revealAnswer(lobbyId: string) {
    console.log("[LOBBY] revealAnswer called:", lobbyId);
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    const question = lobby.quiz.questions[lobby.currentQuestion];
    if (!question) throw new Error("Question not started");

    const aMap = lobby.answers.get(question.id) || new Map();
    console.log("[LOBBY] Answer map:", Array.from(aMap.entries()));

    const stats = new Map<number, number>();
    for (const choiceIdx of aMap.values()) {
      stats.set(choiceIdx, (stats.get(choiceIdx) || 0) + 1);
    }
    console.log("[LOBBY] Stats computed:", Array.from(stats.entries()));

    for (const [viewerId, choiceIdx] of aMap.entries()) {
      if (choiceIdx === question.correctChoice) {
        const prev = lobby.scores.get(viewerId) || 0;
        lobby.scores.set(viewerId, prev + 1);
        console.log("[LOBBY] Correct answer awarded to:", viewerId);
      }
    }

    if (lobby.questionTimer) {
      clearTimeout(lobby.questionTimer);
      lobby.questionTimer = undefined;
      console.log("[LOBBY] Cleared question timer after reveal");
    }
    lobby.questionStartedAt = undefined;

    const scoreboard = Array.from(lobby.scores.entries())
      .map(([viewerId, score]) => ({ viewerId, score }))
      .sort((a, b) => b.score - a.score);

    console.log("[LOBBY] Final scoreboard:", scoreboard);
    return { correct: question.correctChoice, stats, scoreboard };
  }

  async endQuiz(lobbyId: string): Promise<QuizEndResult[]> {
    console.log("[LOBBY] endQuiz called:", lobbyId);
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    if (lobby.questionTimer) {
      clearTimeout(lobby.questionTimer);
      lobby.questionTimer = undefined;
      console.log("[LOBBY] Cleared question timer on endQuiz");
    }

    const results: QuizEndResult[] = [];

    for (const viewer of lobby.participants.values()) {
      console.log("[LOBBY] Saving results for viewer:", viewer.id);
      const viewerRecord = await prisma.viewer.upsert({
        where: { twitchUserId: viewer.id },
        update: { displayName: viewer.displayName },
        create: { twitchUserId: viewer.id, displayName: viewer.displayName },
      });

      const answerCreates = lobby.quiz.questions.map((q) => {
        const map = lobby.answers.get(q.id);
        const idx = map?.get(viewer.id);
        const isCorrect = idx === q.correctChoice;
        return { questionId: q.id, selectedIdx: idx ?? -1, isCorrect };
      });

      const score = answerCreates.filter((a) => a.isCorrect).length;

      await prisma.quizResult.create({
        data: {
          quizId: lobby.quiz.id,
          viewerId: viewerRecord.id,
          score,
          answers: { create: answerCreates },
        },
      });

      results.push({ viewerId: viewer.id, score });
      console.log("[LOBBY] Result saved:", { viewerId: viewer.id, score });
    }

    this.lobbies.delete(lobbyId);
    console.log("[LOBBY] Lobby deleted after endQuiz:", lobbyId);
    return results;
  }

  handleHostDisconnect(io: SocketIOServer, hostId: string) {
    console.log("[LOBBY] handleHostDisconnect called:", hostId);
    for (const lobby of this.lobbies.values()) {
      if (lobby.hostId === hostId) {
        console.log("[LOBBY] Found lobby to mark host disconnected:", lobby.id);
        lobby.hostSocketId = undefined;
        if (lobby.reconnectTimer) clearTimeout(lobby.reconnectTimer);
        lobby.reconnectTimer = setTimeout(async () => {
          console.log(
            "[LOBBY] Host did not reconnect in time, ending quiz:",
            lobby.id
          );
          const results = await this.endQuiz(lobby.id);
          const msg: QuizEndedPayload = { results };
          io.to(lobby.id).emit("quiz_ended", msg);
        }, 60 * 60 * 1000);
      }
    }
  }

  handleHostReconnect(hostId: string, socketId: string) {
    console.log("[LOBBY] handleHostReconnect called:", { hostId, socketId });
    for (const lobby of this.lobbies.values()) {
      if (lobby.hostId === hostId) {
        console.log("[LOBBY] Host reconnected to lobby:", lobby.id);
        lobby.hostSocketId = socketId;
        if (lobby.reconnectTimer) {
          clearTimeout(lobby.reconnectTimer);
          lobby.reconnectTimer = undefined;
        }
      }
    }
  }

  removeLobbiesByHost(hostId: string) {
    console.log("[LOBBY] removeLobbiesByHost called:", hostId);
    for (const [id, lobby] of this.lobbies) {
      if (lobby.hostId === hostId) {
        console.log("[LOBBY] Removing lobby:", id);
        if (lobby.questionTimer) clearTimeout(lobby.questionTimer);
        this.lobbies.delete(id);
      }
    }
  }

  removeViewerEverywhere(viewerId: string) {
    console.log("[LOBBY] removeViewerEverywhere called:", viewerId);
    for (const lobby of this.lobbies.values()) {
      if (lobby.viewers.has(viewerId)) {
        console.log("[LOBBY] Removing viewer from lobby:", lobby.id);
        lobby.viewers.delete(viewerId);
      }
    }
  }
}

export const lobbyManager = new LobbyManager();
export type { LobbyState } from "./types";
