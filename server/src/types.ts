import type { Prisma } from "@wizzy/prisma";

export type QuizWithQuestions = Prisma.QuizGetPayload<{
  include: {
    questions: {
      include: { choices: true };
    };
  };
}>;

export interface ViewerInLobby {
  id: string;
  displayName: string;
  imageUrl?: string;
  socketId: string;
}

export interface LobbyConfig {
  maxPlayers: number;
  questionDuration: number;
}

export interface LobbyState {
  id: string;
  hostId: string;
  hostSocketId?: string;
  quiz: QuizWithQuestions;
  config: LobbyConfig;
  viewers: Map<string, ViewerInLobby>;
  /**
   * Tracks every viewer that has ever joined the lobby, even if they
   * disconnect before the quiz ends. This allows us to persist results
   * for players that left early.
   */
  participants: Map<string, ViewerInLobby>;
  scores: Map<string, number>;
  currentQuestion: number;
  answers: Map<string, Map<string, number>>;
  questionTimer?: NodeJS.Timeout;
  reconnectTimer?: NodeJS.Timeout;
}

export interface QuizEndResult {
  viewerId: string;
  score: number;
}
