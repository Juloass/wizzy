import { AddressInfo } from "net";
import { io as Client } from "socket.io-client";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { QuestionStartedPayload } from "@wizzy/shared";
import { createApp } from "../src/index";
import { lobbyManager } from "../src/lobbyManager";

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
      {
        id: "q2",
        text: "Q2",
        choices: [
          { id: "c1", text: "A", index: 0 },
          { id: "c2", text: "B", index: 1 },
        ],
        correctChoice: 1,
        order: 1,
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

function once<T>(socket: any, event: string) {
  return new Promise<T>((resolve) => socket.once(event, resolve));
}

describe("socket additional flows", () => {
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

  it("starts and auto reveals a question", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s" },
    });
    const sCreated = once<{ lobbyId: string }>(streamer, "lobby_created");
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: 0.05 },
    });
    const { lobbyId } = await sCreated;

    const viewer = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v1" },
    });
    const joined = once(viewer, "lobby_joined");
    viewer.emit("join_lobby", { lobbyId });
    await joined;

    const qStarted = once(viewer, "question_started");
    streamer.emit("start_question", { lobbyId });
    await qStarted;

    viewer.emit("submit_answer", { lobbyId, choiceIndex: 0 });

    const reveal = once<{ correct: number }>(viewer, "answer_reveal");
    const recap = once(streamer, "question_recap");
    const score = once<{ score: number }>(viewer, "score_update");
    const [rev, sc] = await Promise.all([reveal, score]);
    const rc = await recap;

    expect(rev.correct).toBe(0);
    expect(sc.score).toBe(1);
    expect(rc.correct).toBe(0);

    viewer.close();
    streamer.close();
  });

  it("allows joining late during a question", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s" },
    });
    const sCreated = once<{ lobbyId: string }>(streamer, "lobby_created");
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: 0.05 },
    });
    const { lobbyId } = await sCreated;

    const viewer1 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v1" },
    });
    const join1 = once(viewer1, "lobby_joined");
    viewer1.emit("join_lobby", { lobbyId });
    await join1;

    const qStarted = once(viewer1, "question_started");
    streamer.emit("start_question", { lobbyId });
    await qStarted;

    // Join second viewer after question has started
    const viewer2 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v2" },
    });
    const join2 = once(viewer2, "lobby_joined");
    viewer2.emit("join_lobby", { lobbyId });
    const start2 = once<QuestionStartedPayload>(viewer2, "question_started");
    await join2;
    const startedPayload = await start2;
    expect(startedPayload.remaining).toBeGreaterThan(0);

    viewer1.emit("submit_answer", { lobbyId, choiceIndex: 0 });

    const reveal1 = once(viewer1, "answer_reveal");
    const reveal2 = once(viewer2, "answer_reveal");
    const score1 = once<{ score: number }>(viewer1, "score_update");
    const score2 = once<{ score: number }>(viewer2, "score_update");
    await Promise.all([reveal1, reveal2, score1, score2]);

    expect(startedPayload.id).toBe("q1");
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(2);

    viewer1.close();
    viewer2.close();
    streamer.close();
  });

  it("updates scores over multiple questions", async () => {
    const streamer = Client(`http://localhost:${port}`, {
      auth: { role: "streamer", accessToken: "s" },
    });
    const sCreated = once<{ lobbyId: string }>(streamer, "lobby_created");
    streamer.emit("create_lobby", {
      quizId: "quiz1",
      config: { questionDuration: 0.05 },
    });
    const { lobbyId } = await sCreated;

    const viewer1 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v1" },
    });
    const viewer2 = Client(`http://localhost:${port}`, {
      auth: { role: "viewer", token: "v2" },
    });
    const join1 = once(viewer1, "lobby_joined");
    const join2 = once(viewer2, "lobby_joined");
    viewer1.emit("join_lobby", { lobbyId });
    viewer2.emit("join_lobby", { lobbyId });
    await Promise.all([join1, join2]);

    // Question 1
    streamer.emit("start_question", { lobbyId });
    await once(viewer1, "question_started");
    viewer1.emit("submit_answer", { lobbyId, choiceIndex: 0 });
    viewer2.emit("submit_answer", { lobbyId, choiceIndex: 1 });
    const score1q1 = once<{ score: number }>(viewer1, "score_update");
    const score2q1 = once<{ score: number }>(viewer2, "score_update");
    await Promise.all([score1q1, score2q1, once(streamer, "question_recap")]);

    expect((await score1q1).score).toBe(1);
    expect((await score2q1).score).toBe(0);

    // Question 2
    streamer.emit("start_question", { lobbyId });
    await once(viewer1, "question_started");
    viewer1.emit("submit_answer", { lobbyId, choiceIndex: 0 });
    viewer2.emit("submit_answer", { lobbyId, choiceIndex: 1 });
    const score1q2 = once<{ score: number }>(viewer1, "score_update");
    const score2q2 = once<{ score: number }>(viewer2, "score_update");
    await Promise.all([score1q2, score2q2, once(streamer, "question_recap")]);

    expect((await score1q2).score).toBe(1);
    expect((await score2q2).score).toBe(1);

    viewer1.close();
    viewer2.close();
    streamer.close();
  });
});

