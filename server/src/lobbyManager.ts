import { prisma } from "./lib/prisma";
import { DEFAULT_MAX_PLAYERS, DEFAULT_QUESTION_DURATION } from "@wizzy/shared";
import {
  LobbyConfig,
  LobbyState,
  ViewerInLobby,
  QuizWithQuestions,
  QuizEndResult,
} from "./types";
import { randomUUID } from "crypto";

class LobbyManager {
  private lobbies = new Map<string, LobbyState>();

  async createLobby(
    hostId: string,
    hostSocketId: string,
    quizId: string,
    config?: Partial<LobbyConfig>
  ): Promise<LobbyState> {
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, owner: { twitchId: hostId } },
      include: {
        questions: {
          include: { choices: true },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!quiz) {
      throw new Error("Quiz not found or not owned by streamer");
    }

    const lobbyId = randomUUID();
    const lobby: LobbyState = {
      id: lobbyId,
      hostId,
      hostSocketId,
      quiz: quiz as QuizWithQuestions,
      config: {
        maxPlayers: config?.maxPlayers ?? DEFAULT_MAX_PLAYERS,
        questionDuration: config?.questionDuration ?? DEFAULT_QUESTION_DURATION,
      },
      viewers: new Map(),
      participants: new Map(),
      scores: new Map(),
      currentQuestion: -1,
      answers: new Map(),
    };
    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }

  getLobby(id: string): LobbyState | undefined {
    return this.lobbies.get(id);
  }

  removeLobby(id: string) {
    const lobby = this.lobbies.get(id);
    if (lobby?.questionTimer) {
      clearTimeout(lobby.questionTimer);
    }
    this.lobbies.delete(id);
  }

  joinLobby(lobbyId: string, viewer: ViewerInLobby) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    lobby.viewers.set(viewer.id, viewer);
    lobby.participants.set(viewer.id, viewer);
    if (!lobby.scores.has(viewer.id)) {
      lobby.scores.set(viewer.id, 0);
    }
  }

  removeViewer(lobbyId: string, viewerId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    lobby.viewers.delete(viewerId);
    if (lobby.viewers.size === 0 && lobby.currentQuestion === -1) {
      // optional cleanup
    }
  }

  startQuestion(lobbyId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    if (lobby.questionTimer) {
      clearTimeout(lobby.questionTimer);
      lobby.questionTimer = undefined;
    }

    lobby.currentQuestion++;
    const q = lobby.quiz.questions[lobby.currentQuestion];
    if (!q) throw new Error("No more questions");
    lobby.answers.set(q.id, new Map());
    return q;
  }

  submitAnswer(lobbyId: string, viewerId: string, choiceIndex: number) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const question = lobby.quiz.questions[lobby.currentQuestion];
    if (!question) throw new Error("Question not started");
    const aMap = lobby.answers.get(question.id);
    if (!aMap) throw new Error("Question state missing");
    aMap.set(viewerId, choiceIndex);
  }

  revealAnswer(lobbyId: string) {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const question = lobby.quiz.questions[lobby.currentQuestion];
    if (!question) throw new Error("Question not started");
    const aMap = lobby.answers.get(question.id) || new Map();

    const stats = new Map<number, number>();
    for (const choiceIdx of aMap.values()) {
      stats.set(choiceIdx, (stats.get(choiceIdx) || 0) + 1);
    }

    for (const [viewerId, choiceIdx] of aMap.entries()) {
      if (choiceIdx === question.correctChoice) {
        const prev = lobby.scores.get(viewerId) || 0;
        lobby.scores.set(viewerId, prev + 1);
      }
    }

    if (lobby.questionTimer) {
      clearTimeout(lobby.questionTimer);
      lobby.questionTimer = undefined;
    }

    const scoreboard = Array.from(lobby.scores.entries())
      .map(([viewerId, score]) => ({ viewerId, score }))
      .sort((a, b) => b.score - a.score);

    return { correct: question.correctChoice, stats, scoreboard };
  }

  async endQuiz(lobbyId: string): Promise<QuizEndResult[]> {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) throw new Error("Lobby not found");

    if (lobby.questionTimer) {
      clearTimeout(lobby.questionTimer);
      lobby.questionTimer = undefined;
    }

    const results: QuizEndResult[] = [];

    for (const viewer of lobby.participants.values()) {
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
    }

    this.lobbies.delete(lobbyId);
    return results;
  }

  removeLobbiesByHost(hostId: string) {
    for (const [id, lobby] of this.lobbies) {
      if (lobby.hostId === hostId) {
        if (lobby.questionTimer) {
          clearTimeout(lobby.questionTimer);
        }
        this.lobbies.delete(id);
      }
    }
  }

  removeViewerEverywhere(viewerId: string) {
    for (const lobby of this.lobbies.values()) {
      if (lobby.viewers.has(viewerId)) {
        lobby.viewers.delete(viewerId);
      }
    }
  }
}

export const lobbyManager = new LobbyManager();
export type { LobbyState } from "./types";
