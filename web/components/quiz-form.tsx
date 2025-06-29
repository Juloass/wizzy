'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { FileDrop } from '@/components/ui/file-drop'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Trash2, Settings } from 'lucide-react'
import { Inter } from 'next/font/google'
import { cn } from '@/lib/utils'
import { storeAudioBlob } from '@/lib/audio'
import { toast } from '@/components/ui/sonner'
import { exportQuiz, importQuiz } from '@/lib/quizIO'
import type { QuizPayload, QuestionPayload } from '@/lib/types'

const inter = Inter({ subsets: ['latin'] })

interface QuestionForm extends QuestionPayload {
  audioEnabled?: boolean
}

export default function QuizForm({ quiz }: { quiz: QuizPayload & { id: string } }) {
  const [name, setName] = useState(quiz.name || '')
  const [description, setDescription] = useState(quiz.description || '')
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

  const handleImport = async (file: File | null) => {
    if (!file) return
    try {
      const data = await importQuiz(file)
      setName(data.name || '')
      setDescription(data.description || '')
      setQuestions(
        (data.questions || []).map((q) => ({
          ...q,
          audioEnabled: Boolean(q.audioPromptKey || q.audioRevealKey),
        }))
      )
      toast.success('Imported quiz')
    } catch {
      toast.error('Failed to import')
    }
  }

  const handleExport = () => {
    exportQuiz({
      name,
      description,
      questions: questions.map(({ audioEnabled, ...rest }) => {
        void audioEnabled
        return rest
      }),
    })
  }

  const onSubmit = async () => {
    if (!validate()) return
    const payload = {
      name,
      description,
      questions: questions.map(({ audioEnabled, ...rest }) => {
        void audioEnabled
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
        <Button
          type="button"
          onClick={handleAddQuestion}
          className="w-full bg-[#9147FF] hover:bg-[#A86EFF]"
        >
          + Add Question
        </Button>
        <div className="flex flex-col gap-2 overflow-y-auto pr-2">
          {questions.map((q, idx) => (
            <Button
              key={q.id}
              variant="ghost"
              onClick={() => setTab(q.id)}
              className={cn(
                'justify-start',
                'px-4',
                tab === q.id
                  ? 'border border-[#9147FF] bg-[#9147FF]/20 text-white'
                  : 'bg-[#202026] text-[#C0C0C0] hover:bg-[#23232A]'
              )}
            >
              Question {idx + 1}
            </Button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8 space-y-8">
        <div
          className="flex items-center justify-between rounded-lg p-6 shadow"
          style={{ backgroundColor: '#15151A' }}
        >
          <h2 className="text-2xl font-semibold">{name || 'Quiz Name'}</h2>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-xl">
                <Settings className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0">
              <Card className="bg-[#15151A] text-white border-none shadow">
                <CardHeader>
                  <CardTitle>Quiz Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Quiz name"
                    style={{ backgroundColor: '#202026', borderColor: '#2A2A33' }}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    rows={3}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    style={{ backgroundColor: '#202026', borderColor: '#2A2A33' }}
                  />
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="application/json"
                      onChange={(e) => handleImport(e.target.files?.[0] || null)}
                    />
                    <Button type="button" onClick={handleExport} className="w-full">
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </PopoverContent>
          </Popover>
        </div>
        {questions.map((q, idx) => {
          const audioEnabled = q.audioEnabled ?? Boolean(q.audioPromptKey || q.audioRevealKey)
          if (q.id !== tab) return null
          return (
            <Card key={q.id} className="shadow" style={{ backgroundColor: '#15151A' }}>
              <CardContent className="space-y-6">
                <Input
                  value={q.text}
                  onChange={(e) => updateQuestionText(idx, e.target.value)}
                  placeholder="Question text"
                  style={{ backgroundColor: '#202026', borderColor: '#2A2A33' }}
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
                    <Input
                      className="flex-1"
                      style={{ backgroundColor: '#202026', borderColor: '#2A2A33' }}
                      value={c.text}
                      onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                      placeholder={`Answer ${cIdx + 1}`}
                    />
                    <Button
                      type="button"
                      onClick={() => removeChoice(idx, cIdx)}
                      variant="ghost"
                      className="text-[#C0C0C0] hover:text-white"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => addChoice(idx)}
                  disabled={q.choices.length >= 4}
                  className="w-full bg-[#9147FF] hover:bg-[#A86EFF]"
                >
                  + Add Answer
                </Button>
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
              </CardContent>
            </Card>
          )
        })}
        {errors.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive p-4 text-destructive">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        <Button onClick={onSubmit} className="bg-[#9147FF] hover:bg-[#A86EFF]">
          Save Quiz
        </Button>
      </main>
    </div>
  )
}
