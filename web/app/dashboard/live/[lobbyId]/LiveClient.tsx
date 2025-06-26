'use client';
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type {
  AnswerRevealPayload,
  QuestionRecapPayload,
  QuestionStartedPayload,
  QuizEndedPayload,
  ScoreEntry,
} from "@wizzy/shared";
import { DEFAULT_QUESTION_DURATION } from "@wizzy/shared";
import { Button } from "@/components/ui/button";

interface Props {
  lobbyId: string;
  accessToken: string;
}

export default function LiveClient({ lobbyId, accessToken }: Props) {
  const [question, setQuestion] = useState<QuestionStartedPayload | null>(null);
  const [stats, setStats] = useState<[number, number][]>([]);
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);
  const [remaining, setRemaining] = useState(0);
  const duration = useRef(DEFAULT_QUESTION_DURATION);
  const socketRef = useRef<ReturnType<typeof io>>();

  // handle countdown
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0.1 ? Number((r - 0.1).toFixed(1)) : 0));
    }, 100);
    return () => clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    const socket = io("/", {
      autoConnect: false,
      auth: { role: "streamer", accessToken },
    });
    socketRef.current = socket;
    socket.connect();

    socket.on("question_started", (q: QuestionStartedPayload) => {
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

  return (
    <div className="flex h-full">
      <main className="flex-1 p-4 space-y-4">
        <div className="w-48 h-32 border-2 border-dashed flex items-center justify-center text-sm text-gray-500 mb-4">
          Camera
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Live Controls</h1>
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
              <ul className="space-y-1">
                {question.choices.map((c) => (
                  <li key={c.index}>{c.index + 1}. {c.text}</li>
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
            <Button type="button" onClick={startQuestion}>Start/Next</Button>
            <Button type="button" onClick={reveal}>Reveal</Button>
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
