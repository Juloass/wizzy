import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { io as Client } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createApp } from '../src/index';
import { lobbyManager } from '../src/lobbyManager';

vi.mock('../src/lib/prisma', () => {
  const quiz = {
    id: 'quiz1',
    questions: [
      {
        id: 'q1',
        text: 'Q1',
        choices: [
          { id: 'c1', text: 'A', index: 0 },
          { id: 'c2', text: 'B', index: 1 },
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
        upsert: vi.fn().mockResolvedValue({ id: 'v', twitchUserId: 'v' }),
      },
      quizResult: {
        create: vi.fn(),
      },
    },
  };
});

const testEnv = { NODE_ENV: 'development' };

describe('socket server', () => {
  let httpServer: ReturnType<typeof createApp>['httpServer'];
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
    lobbyManager['lobbies'].clear();
  });

  it('runs full quiz flow', async () => {
    const streamer = Client(`http://localhost:${port}`, { auth: { role: 'streamer', accessToken: 's1' } });
    const sCreated = new Promise<{ lobbyId: string }>((resolve) => streamer.on('lobby_created', resolve));
    streamer.emit('create_lobby', { quizId: 'quiz1' });
    const { lobbyId } = await sCreated;

    const viewer1 = Client(`http://localhost:${port}`, { auth: { role: 'viewer', token: 'v1' } });
    const viewer2 = Client(`http://localhost:${port}`, { auth: { role: 'viewer', token: 'v2' } });

    const join1 = new Promise((r) => viewer1.on('lobby_joined', r));
    const join2 = new Promise((r) => viewer2.on('lobby_joined', r));
    viewer1.emit('join_lobby', { lobbyId });
    viewer2.emit('join_lobby', { lobbyId });
    await join1;
    await join2;

    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(2);

    const qStarted = new Promise((r) => streamer.on('question_started', r));
    streamer.emit('start_question', { lobbyId });
    await qStarted;

    viewer1.emit('submit_answer', { lobbyId, choiceIndex: 0 });
    viewer2.emit('submit_answer', { lobbyId, choiceIndex: 1 });

    const reveal = new Promise<{ correct: number; stats: [number, number][] }>((r) => streamer.on('answer_reveal', r));
    streamer.emit('reveal_answer', { lobbyId });
    const stats = await reveal;
    expect(stats.correct).toBe(0);

    viewer2.close();
    await new Promise((f) => setTimeout(f, 50));
    expect(lobbyManager.getLobby(lobbyId)?.viewers.size).toBe(1);

    const ended = new Promise<{ results: any[] }>((r) => streamer.on('quiz_ended', r));
    streamer.emit('end_quiz', { lobbyId });
    const res = await ended;
    expect(res.results.length).toBe(1);

    streamer.close();
  });
});
