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
  participants: Map<string, ViewerInLobby>;
  scores: Map<string, number>;
  currentQuestion: number;
  answers: Map<string, Map<string, number>>;
  questionStartedAt?: number;
  reconnectTimer?: NodeJS.Timeout;
}

export interface QuizEndResult {
  viewerId: string;
  score: number;
}
