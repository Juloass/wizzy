'use client';
import { useState } from 'react';
import { storeAudioBlob } from '@/lib/audio';
import { Button } from '@/components/ui/button';

interface Choice { id: string; text: string; index: number; }
interface Question { id: string; text: string; choices: Choice[]; correctChoice: number; audioPromptKey?: string | null; audioRevealKey?: string | null; order: number; }

export default function QuizForm({ quiz }: { quiz: any }) {
  const [name, setName] = useState(quiz.name || '');
  const [description, setDescription] = useState(quiz.description || '');
  const [questions, setQuestions] = useState<Question[]>(quiz.questions || []);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: crypto.randomUUID(), text: '', choices: [], correctChoice: 0, order: questions.length },
    ]);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <input
          className="border p-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Quiz name"
        />
      </div>
      <div>
        <textarea
          className="border p-2 w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />
      </div>
      {questions.map((q, idx) => (
        <div key={q.id} className="border p-2 space-y-2">
          <input
            className="border p-1 w-full"
            value={q.text}
            onChange={(e) => {
              const copy = [...questions];
              copy[idx].text = e.target.value;
              setQuestions(copy);
            }}
            placeholder={`Question ${idx + 1}`}
          />
          {q.choices.map((c, cIdx) => (
            <div key={c.id} className="flex gap-2 items-center">
              <input
                className="border p-1 flex-grow"
                value={c.text}
                onChange={(e) => {
                  const copy = [...questions];
                  copy[idx].choices[cIdx].text = e.target.value;
                  setQuestions(copy);
                }}
                placeholder={`Choice ${cIdx + 1}`}
              />
              <Button type="button" onClick={() => {
                const copy = [...questions];
                copy[idx].choices.splice(cIdx,1);
                setQuestions(copy);
              }}>Remove</Button>
            </div>
          ))}
          <Button type="button" onClick={() => {
            const copy = [...questions];
            copy[idx].choices.push({ id: crypto.randomUUID(), text: '', index: copy[idx].choices.length });
            setQuestions(copy);
          }}>Add Choice</Button>
        </div>
      ))}
      <Button type="button" onClick={addQuestion}>Add Question</Button>
    </div>
  );
}
