'use client';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface Props { params: { lobbyId: string } }

export default function LivePage({ params }: Props) {
  const [question, setQuestion] = useState<any>(null);
  const [stats, setStats] = useState<[number, number][]>([]);

  useEffect(() => {
    const socket = io('/', { autoConnect: false, auth: { role: 'streamer', accessToken: '' } });
    socket.connect();
    socket.emit('join_lobby', { lobbyId: params.lobbyId });
    socket.on('question_started', (q) => setQuestion(q));
    socket.on('answer_reveal', (p) => setStats(p.stats));
    return () => { socket.disconnect(); };
  }, [params.lobbyId]);

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-bold">Live Controls</h1>
      {question && <div>{question.text}</div>}
      {stats.length > 0 && (
        <ul>
          {stats.map(([idx, count]) => (
            <li key={idx}>{idx}: {count}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
