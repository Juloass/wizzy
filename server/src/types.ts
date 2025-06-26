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
}

export interface LobbyState {
  id: string;
  hostId: string;
  quiz: QuizWithQuestions;
  config: LobbyConfig;
  viewers: Map<string, ViewerInLobby>;
  currentQuestion: number;
  answers: Map<string, Map<string, number>>;
}

export interface QuizEndResult {
  viewerId: string;
  score: number;
}
