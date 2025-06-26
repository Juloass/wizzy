// @wizzy/shared/types.ts

import { Viewer } from "./prisma";

// Définir les directions possibles
export type SocketDirection =
  | "viewer->server"
  | "web->server"
  | "server->viewer"
  | "server->web";

// Mapping de chaque type d'événement à son payload et sa direction
type SocketEventDefinition = {
  join: {
    direction: "server->web";
    payload: { player: Viewer };
  };
  reconnect: {
    direction: "server->web";
    payload: { player: Viewer };
  };
  answer: {
    direction: "viewer->server";
    payload: { playerId: string; answer: number };
  };
  start: {
    direction: "web->server";
    payload: undefined;
  };
  next: {
    direction: "web->server";
    payload: undefined;
  };
  leave: {
    direction: "viewer->server";
    payload: { playerId: string };
  };
  end: {
    direction: "server->viewer";
    payload: undefined;
  };
};

// 3. Générer automatiquement le type SocketEvent
export type SocketEvent = {
  [K in keyof SocketEventDefinition]: {
    type: K;
    direction: SocketEventDefinition[K]["direction"];
    payload: SocketEventDefinition[K]["payload"];
  };
}[keyof SocketEventDefinition];

// Generic scoreboard entry
export interface ScoreEntry {
  viewerId: string;
  score: number;
}

// Payload types for socket events
export interface CreateLobbyPayload {
  quizId: string;
  config?: { maxPlayers?: number; questionDuration?: number };
}
export interface LobbyCreatedPayload {
  lobbyId: string;
}

export interface JoinLobbyPayload {
  lobbyId: string;
}
export interface LobbyJoinedPayload {
  lobbyId: string;
}

export interface StartQuestionPayload {
  lobbyId: string;
}
export interface QuestionStartedPayload {
  id: string;
  text: string;
  choices: { index: number; text: string }[];
  audioPromptKey?: string | null;
}

export interface SubmitAnswerPayload {
  lobbyId: string;
  choiceIndex: number;
}

export interface AnswerRevealPayload {
  correct: number;
  stats: [number, number][];
}

export interface QuestionRecapPayload {
  questionId: string;
  correct: number;
  stats: [number, number][];
  scoreboard: ScoreEntry[];
}

export interface ScoreUpdatePayload {
  score: number;
  rank: number;
  top: ScoreEntry[];
}

export interface EndQuizPayload {
  lobbyId: string;
}
export interface QuizEndedPayload {
  results: ScoreEntry[];
}

export interface ErrorPayload {
  message: string;
}
