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
