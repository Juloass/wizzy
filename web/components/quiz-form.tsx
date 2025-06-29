'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { FileDrop } from '@/components/ui/file-drop'
import { Trash2 } from 'lucide-react'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { storeAudioBlob } from '@/lib/audio'
import { toast } from '@/components/ui/sonner'
import type { QuizPayload, QuestionPayload } from '@/lib/types'

const inter = Inter({ subsets: ['latin'] })

interface QuestionForm extends QuestionPayload {
  audioEnabled?: boolean
}

export default function QuizForm({ quiz }: { quiz: QuizPayload & { id: string } }) {
  const [name, setName] = useState(quiz.name || '')
  const [description] = useState(quiz.description || '')
  const [questions, setQuestions] = useState<QuestionForm[]>(
    (quiz.questions || []).map((q) => ({
      ...q,
      audioEnabled: Boolean(q.audioPromptKey || q.audioRevealKey),
    }))
  )
  const [errors, setErrors] = useState<string[]>([])
  const [tab, setTab] = useState<string>(quiz.questions?.[0]?.id || 'add')

  const handleAddQuestion = () => {
    const id = crypto.randomUUID()
    setQuestions([
      ...questions,
      {
        id,
        text: '',
        choices: [],
        correctChoice: 0,
        audioEnabled: false,
        order: questions.length,
      },
    ])
    setTab(id)
  }

  const addChoice = (qIdx: number) => {
    const copy = [...questions]
    if (copy[qIdx].choices.length >= 4) return
    copy[qIdx].choices.push({
      id: crypto.randomUUID(),
      text: '',
      index: copy[qIdx].choices.length,
    })
    setQuestions(copy)
  }

  const updateChoice = (qIdx: number, cIdx: number, text: string) => {
    const copy = [...questions]
    copy[qIdx].choices[cIdx].text = text
    setQuestions(copy)
  }

  const removeChoice = (qIdx: number, cIdx: number) => {
    const copy = [...questions]
    copy[qIdx].choices.splice(cIdx, 1)
    setQuestions(copy)
  }

  const updateQuestionText = (idx: number, text: string) => {
    const copy = [...questions]
    copy[idx].text = text
    setQuestions(copy)
  }

  const handleAudio = async (
    idx: number,
    type: 'prompt' | 'reveal',
    file: File | null,
  ) => {
    if (!file) return
    const key = await storeAudioBlob(file)
    const copy = [...questions]
    if (type === 'prompt') copy[idx].audioPromptKey = key
    else copy[idx].audioRevealKey = key
    copy[idx].audioEnabled = true
    setQuestions(copy)
  }

  const toggleAudio = (idx: number, enabled: boolean) => {
    const copy = [...questions]
    if (!enabled) {
      copy[idx].audioPromptKey = null
      copy[idx].audioRevealKey = null
    }
    copy[idx].audioEnabled = enabled
    setQuestions(copy)
  }

  const validate = () => {
    const errs: string[] = []
    if (!name.trim()) errs.push('Quiz name required')
    if (questions.length === 0) errs.push('At least one question')
    questions.forEach((q, i) => {
      if (q.choices.length < 2 || q.choices.length > 4) {
        errs.push(`Question ${i + 1} must have 2–4 choices`)
      }
    })
    setErrors(errs)
    return errs.length === 0
  }

  const editQuizName = () => {
    const newName = window.prompt('Quiz name', name)
    if (newName !== null) setName(newName)
  }


  const onSubmit = async () => {
    if (!validate()) return
    const payload = {
      name,
      description,
      questions: questions.map((q) => {
        const { audioEnabled: _, ...rest } = q // eslint-disable-line @typescript-eslint/no-unused-vars
        return rest
      }),
    }
    const res = await fetch(quiz.id ? `/api/quiz/${quiz.id}` : '/api/quiz', {
      method: quiz.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      window.location.href = '/dashboard'
    } else {
      const msg = await res.text()
      setErrors([msg || 'Failed to save'])
      toast.error(msg || 'Failed to save')
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-screen text-white',
        inter.className,
      )}
      style={{ backgroundColor: '#0E0E12' }}
    >
      <aside
        className="w-[300px] flex flex-col p-6 space-y-6"
        style={{ backgroundColor: '#15151A' }}
      >
        <div className="flex items-center gap-2 text-xl font-bold">
          <span role="img" aria-label="wizard">🧙‍♂️</span>
          <span>Wizzy</span>
        </div>
        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full rounded-md bg-[#9147FF] py-2 transition-colors hover:bg-[#A86EFF]"
        >
          + Add Question
        </button>
        <div className="flex flex-col gap-2 overflow-y-auto pr-2">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setTab(q.id)}
              className={cn(
                'px-4 py-2 rounded-full text-left text-sm',
                tab === q.id
                  ? 'border border-[#9147FF] bg-[#9147FF]/20 text-white'
                  : 'bg-[#202026] text-[#C0C0C0] hover:bg-[#23232A]'
              )}
            >
              Question {idx + 1}
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        <div
          className="flex items-center justify-between rounded-lg p-6 shadow"
          style={{ backgroundColor: '#15151A' }}
        >
          <h2 className="text-2xl font-semibold">{name || 'Quiz Name'}</h2>
          <button type="button" onClick={editQuizName} className="text-xl">⚙️</button>
        </div>
        {questions.map((q, idx) => {
          const audioEnabled = q.audioEnabled ?? Boolean(q.audioPromptKey || q.audioRevealKey)
          if (q.id !== tab) return null
          return (
            <div
              key={q.id}
              className="space-y-6 rounded-lg p-6 shadow"
              style={{ backgroundColor: '#15151A' }}
            >
              <input
                className="w-full rounded-md border px-3 py-2 text-sm placeholder-[#C0C0C0]"
                style={{ backgroundColor: '#202026', borderColor: '#2A2A33' }}
                value={q.text}
                onChange={(e) => updateQuestionText(idx, e.target.value)}
                placeholder="Question text"
              />
              <label className="flex items-center gap-3 text-[#C0C0C0]">
                <Switch
                  checked={audioEnabled}
                  onCheckedChange={(v) => toggleAudio(idx, v)}
                  className="data-[state=checked]:bg-[#9147FF]"
                />
                Enable Sounds
              </label>
              {q.choices.map((c, cIdx) => (
                <div key={c.id} className="flex items-center gap-3">
                  <input
                    className="flex-1 rounded-md border px-3 py-2 text-sm placeholder-[#C0C0C0]"
                    style={{ backgroundColor: '#202026', borderColor: '#2A2A33' }}
                    value={c.text}
                    onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                    placeholder={`Answer ${cIdx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeChoice(idx, cIdx)}
                    className="text-[#C0C0C0] transition-colors hover:text-white"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addChoice(idx)}
                disabled={q.choices.length >= 4}
                className="w-full rounded-md bg-[#9147FF] py-2 text-sm transition-colors hover:bg-[#A86EFF] disabled:opacity-50"
              >
                + Add Answer
              </button>
              {audioEnabled && (
                <div className="space-y-2">
                  <FileDrop
                    accept="audio/*"
                    label={
                      q.audioPromptKey
                        ? `Question audio: ${q.audioPromptKey}`
                        : 'Question audio'
                    }
                    playKey={q.audioPromptKey ?? undefined}
                    onFile={(f) => handleAudio(idx, 'prompt', f)}
                  />
                  <FileDrop
                    accept="audio/*"
                    label={
                      q.audioRevealKey
                        ? `Reveal audio: ${q.audioRevealKey}`
                        : 'Reveal audio'
                    }
                    playKey={q.audioRevealKey ?? undefined}
                    onFile={(f) => handleAudio(idx, 'reveal', f)}
                  />
                </div>
              )}
            </div>
          )
        })}
        {errors.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive p-4 text-destructive">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        <button
          onClick={onSubmit}
          className="rounded-md bg-[#9147FF] px-4 py-2 transition-colors hover:bg-[#A86EFF]"
        >
          Save Quiz
        </button>
      </main>
    </div>
  )
}
