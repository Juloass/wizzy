'use client';
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AnswerRevealPayload,
  QuestionRecapPayload,
  QuestionStartedPayload,
  QuizEndedPayload,
  ScoreEntry,
  Viewer,
  SocketEventDefinition,
  SocketDirection,
} from "@wizzy/shared";
import { DEFAULT_QUESTION_DURATION } from "@wizzy/shared";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import ErrorScreen from "@/components/error-screen";

type EventsByDirection<D extends SocketDirection> = {
  [K in keyof SocketEventDefinition as D extends SocketEventDefinition[K]["direction"]
    ? K
    : never]: (payload: SocketEventDefinition[K]["payload"]) => void;
};

type ServerToClientEvents = EventsByDirection<"server->viewer"> &
  EventsByDirection<"server->web">;
type ClientToServerEvents = EventsByDirection<"viewer->server"> &
  EventsByDirection<"web->server">;

interface Props {
  lobbyId: string;
  accessToken: string;
}

export default function LiveClient({ lobbyId, accessToken }: Props) {
  const [question, setQuestion] = useState<QuestionStartedPayload | null>(null);
  const [stats, setStats] = useState<[number, number][]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);
  const [participants, setParticipants] = useState<Viewer[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [preCountdown, setPreCountdown] = useState(0);
  const [connectError, setConnectError] = useState(false);
  const duration = useRef(DEFAULT_QUESTION_DURATION);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents>>();
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

  // handle countdown
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0.1 ? Number((r - 0.1).toFixed(1)) : 0));
    }, 100);
    return () => clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    if (preCountdown <= 0) return;
    const id = setInterval(() => {
      setPreCountdown((c) => (c > 0.1 ? Number((c - 0.1).toFixed(1)) : 0));
    }, 100);
    return () => clearInterval(id);
  }, [preCountdown]);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      socketUrl || undefined,
      {
        autoConnect: false,
        auth: { role: "streamer", accessToken },
      }
    );
    socketRef.current = socket;
    socket.connect();

    socket.on("connect_error", () => {
      setConnectError(true);
      toast.error("Failed to connect to server");
    });
    socket.on("connect", () => {
      setConnectError(false);
    });
    socket.on("disconnect", (reason) => {
      toast.error(`Disconnected: ${reason}`);
    });

    socket.on("join", ({ player }: { player: Viewer }) => {
      setParticipants((p) =>
        p.find((v) => v.id === player.id) ? p : [...p, player]
      );
    });

    socket.on("question_countdown", ({ duration }: { duration: number }) => {
      setPreCountdown(duration);
    });

    socket.on("question_started", (q: QuestionStartedPayload) => {
      setPreCountdown(0);
      setQuestion(q);
      setStats([]);
      duration.current = q.remaining ?? DEFAULT_QUESTION_DURATION;
      setRemaining(duration.current);
    });

    socket.on("answer_reveal", (p: AnswerRevealPayload) => {
      setStats(p.stats);
      setRemaining(0);
    });

    socket.on("question_recap", (r: QuestionRecapPayload) => {
      setScoreboard(r.scoreboard);
    });

    socket.on("quiz_ended", (r: QuizEndedPayload) => {
      setScoreboard(r.results);
      setQuestion(null);
      setStats([]);
      setRemaining(0);
    });

    return () => {
      socket.disconnect();
    };
  }, [lobbyId, accessToken]);

  const startQuestion = () => {
    socketRef.current?.emit("start_question", { lobbyId });
  };
  const reveal = () => {
    socketRef.current?.emit("reveal_answer", { lobbyId });
  };
  const endQuiz = () => {
    socketRef.current?.emit("end_quiz", { lobbyId });
  };

  const progress = duration.current
    ? Math.max(0, Math.min(100, (remaining / duration.current) * 100))
    : 0;

  useEffect(() => {
    if (!connectError) return;
    const id = setTimeout(() => {
      socketRef.current?.connect();
    }, 3000);
    return () => clearTimeout(id);
  }, [connectError]);

  if (connectError) {
    return <ErrorScreen title="Server Unreachable" message="Could not connect to live server." />;
  }

  return (
    <div className="flex h-full">
      <main className="flex-1 p-4 space-y-4">
        <div className="w-48 h-32 border-2 border-dashed flex items-center justify-center text-sm text-gray-500 mb-4">
          Camera
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Live Controls</h1>
          {preCountdown > 0 && !question && (
            <div className="text-center text-2xl font-bold">
              Starting in {preCountdown.toFixed(1)}s
            </div>
          )}
          {!question && preCountdown <= 0 && participants.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="px-2 py-1 rounded bg-muted text-sm"
                >
                  {p.displayName}
                </div>
              ))}
            </div>
          )}
          {question && (
            <div className="space-y-2">
              <div className="text-lg font-semibold">{question.text}</div>
              <div className="h-2 bg-gray-200 rounded">
                <div
                  className="h-2 bg-purple-500 rounded"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-right text-xs">{remaining.toFixed(1)}s</div>
              <ul
                className={`grid gap-2 grid-cols-${
                  question.choices.length === 4 ? 2 : question.choices.length
                }`}
              >
                {question.choices.map((c) => (
                  <li
                    key={c.index}
                    className="border rounded p-2 text-center"
                  >
                    {c.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stats.length > 0 && (
            <ul className="space-y-1">
              {stats.map(([idx, count]) => (
                <li key={idx}>{idx}: {count}</li>
              ))}
            </ul>
          )}
          <div className="space-x-2">
            <Button
              type="button"
              onClick={startQuestion}
              disabled={question !== null || preCountdown > 0}
            >
              Start/Next
            </Button>
            <Button
              type="button"
              onClick={reveal}
              disabled={!question || stats.length > 0}
            >
              Reveal
            </Button>
            <Button type="button" onClick={endQuiz}>End</Button>
          </div>
        </div>
      </main>
      <aside className="w-64 border-l p-4">
        <h2 className="font-bold mb-2">Leaderboard</h2>
        <ol className="space-y-1">
          {scoreboard.map((s, idx) => (
            <li key={s.viewerId} className="text-sm">
              {idx + 1}. {s.viewerId} - {s.score}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
