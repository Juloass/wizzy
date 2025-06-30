import { AddressInfo } from "net";
import { io as Client } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/index";
import { lobbyManager } from "../src/lobbyManager";
import type { ErrorPayload } from "@wizzy/shared";

vi.mock("../src/lib/prisma", () => {
  const quiz = {
    id: "quiz1",
    questions: [
      {
        id: "q1",
        text: "Q1",
        choices: [
          { id: "c1", text: "A", index: 0 },
          { id: "c2", text: "B", index: 1 },
        ],
        correctChoice: 0,
        order: 0,
      },
    ],
  };
  return {
    prisma: {
      quiz: {
        findFirst: vi.fn().mockResolvedValue(quiz),
      },
      viewer: {
        upsert: vi.fn().mockResolvedValue({ id: "v", twitchUserId: "v" }),
      },
      quizResult: {
        create: vi.fn(),
      },
    },
  };
});

const testEnv = { NODE_ENV: "development", QUIZ_COUNTDOWN_MS: "0" };

describe("socket server", () => {
  let httpServer: ReturnType<typeof createApp>["httpServer"];
  let port: number;

  beforeEach(async () => {
    process.env = { ...process.env, ...testEnv };
    const app = createApp();
    httpServer = app.httpServer;
    await new Promise((res) => httpServer.listen(0, res));
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    httpServer.close();
    lobbyManager["lobbies"].clear();
  });

  it("runs full quiz flow", async () => {
    console.log("🟢 Creating lobby");
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s1" },
    });
    const sCreated = new Promise<{ lobbyId: string }>((resolve) =>
      streamer.on("lobby_created", resolve)
    );
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: 0.05 },
    });
    const { lobbyId } = await sCreated;
    console.log("✅ Lobby created with ID:", lobbyId);

    console.log("🟢 Connecting viewers");
    const viewer1 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v1" },
    });
    const viewer2 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v2" },
    });

    const join1 = new Promise((r) => viewer1.on("lobby_joined", r));
    const join2 = new Promise((r) => viewer2.on("lobby_joined", r));
    viewer1.emit("join_lobby", { lobbyId });
    viewer2.emit("join_lobby", { lobbyId });
    await join1;
    await join2;
    console.log("✅ Both viewers joined");

    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(2);

    console.log("🟢 Starting question");
    const qStarted = new Promise((r) => streamer.on("question_started", r));
    streamer.emit("start_question", { lobbyId });
    await qStarted;
    console.log("✅ Question started");

    console.log("🟢 Submitting answers");
    viewer1.emit("submit_answer", { lobbyId, choiceIndex: 0 });
    viewer2.emit("submit_answer", { lobbyId, choiceIndex: 1 });

    const recap = new Promise<any>((r) => streamer.on("question_recap", r));
    const score1 = new Promise<any>((r) => viewer1.on("score_update", r));
    const score2 = new Promise<any>((r) => viewer2.on("score_update", r));
    const rec = await recap;
    const sc1 = await score1;
    const sc2 = await score2;
    console.log("✅ Recap received", rec);
    expect(rec.correct).toBe(0);
    expect(sc1.score).toBe(1);
    expect(sc2.score).toBe(0);

    console.log("🟢 Viewer2 disconnecting");
    viewer2.close();
    await new Promise((f) => setTimeout(f, 50));
    console.log("✅ Viewer2 disconnected");
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(1);

    console.log("🟢 Ending quiz");
    const ended = new Promise<{ results: any[] }>((r) =>
      streamer.on("quiz_ended", r)
    );
    streamer.emit("end_quiz", { lobbyId });
    const res = await ended;
    console.log("✅ Quiz ended with results:", res);
    // both viewers should have their results saved even if one disconnected
    expect(res.results.length).toBe(2);

    streamer.close();
  });
  it("allows viewer to reconnect", async () => {
    console.log("🟢 Creating lobby for reconnect");
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s2" },
    });
    const sCreated = new Promise<{ lobbyId: string }>((r) =>
      streamer.on("lobby_created", r)
    );
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: 0.05 },
    });
    const { lobbyId } = await sCreated;

    const viewer1 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "vr1" },
    });
    await new Promise((r) => {
      viewer1.on("lobby_joined", r);
      viewer1.emit("join_lobby", { lobbyId });
    });
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(1);

    console.log("🟢 Disconnecting viewer");
    viewer1.close();
    await new Promise((f) => setTimeout(f, 50));
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(0);

    console.log("🟢 Reconnecting viewer");
    const viewer1b = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "vr1" },
    });
    await new Promise((r) => {
      viewer1b.on("lobby_joined", r);
      viewer1b.emit("join_lobby", { lobbyId });
    });
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(1);

    const qStarted = new Promise((r) => streamer.on("question_started", r));
    streamer.emit("start_question", { lobbyId });
    await qStarted;
    viewer1b.emit("submit_answer", { lobbyId, choiceIndex: 0 });

    const recap = new Promise<any>((r) => streamer.on("question_recap", r));
    const score = new Promise<any>((r) => viewer1b.on("score_update", r));
    const rec = await recap;
    const sc = await score;
    expect(rec.correct).toBe(0);
    expect(sc.score).toBe(1);

    const ended = new Promise<{ results: any[] }>((r) =>
      streamer.on("quiz_ended", r)
    );
    streamer.emit("end_quiz", { lobbyId });
    const res = await ended;
    expect(res.results.length).toBe(1);

    streamer.close();
    viewer1b.close();
  });

  it("rejects invalid questionDuration", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s1" },
    });
    const err = new Promise<ErrorPayload>((r) => streamer.on("error", r));
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: -5 },
    });
    const res = await err;
    expect(res.message).toMatch(/questionDuration/i);
    streamer.close();
  });

  it("rejects invalid maxPlayers", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s1" },
    });
    const err = new Promise<ErrorPayload>((r) => streamer.on("error", r));
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { maxPlayers: 0 },
    });
    const res = await err;
    expect(res.message).toMatch(/maxPlayers/i);
    streamer.close();
  });

  it("rejects too long questionDuration", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s1" },
    });
    const err = new Promise<ErrorPayload>((r) => streamer.on("error", r));
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: 301 },
    });
    const res = await err;
    expect(res.message).toMatch(/questionDuration/i);
    streamer.close();
  });

  it("rejects too many maxPlayers", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s1" },
    });
    const err = new Promise<ErrorPayload>((r) => streamer.on("error", r));
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { maxPlayers: 101 },
    });
    const res = await err;
    expect(res.message).toMatch(/maxPlayers/i);
    streamer.close();
  });

  it("rejects join when lobby is full", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s1" },
    });
    const created = new Promise<{ lobbyId: string }>((r) =>
      streamer.on("lobby_created", r)
    );
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { maxPlayers: 1 },
    });
    const { lobbyId } = await created;

    const viewer1 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v1" },
    });
    await new Promise((r) => {
      viewer1.on("lobby_joined", r);
      viewer1.emit("join_lobby", { lobbyId });
    });
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(1);

    const viewer2 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v2" },
    });
    const full = new Promise<{ lobbyId: string }>((r) =>
      viewer2.on("lobby_full", r)
    );
    viewer2.emit("join_lobby", { lobbyId });
    const fullMsg = await full;
    expect(fullMsg.lobbyId).toBe(lobbyId);

    viewer1.close();
    viewer2.close();
    streamer.close();
  });
});
