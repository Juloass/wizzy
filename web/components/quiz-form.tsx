'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { exportQuiz, importQuiz } from '@/lib/quizIO'
import { storeAudioBlob } from '@/lib/audio'

interface Choice {
  id: string
  text: string
  index: number
}
interface Question {
  id: string
  text: string
  choices: Choice[]
  correctChoice: number
  audioPromptKey?: string | null
  audioRevealKey?: string | null
  order: number
}

export default function QuizForm({ quiz }: { quiz: any }) {
  const [name, setName] = useState(quiz.name || '')
  const [description, setDescription] = useState(quiz.description || '')
  const [questions, setQuestions] = useState<Question[]>(quiz.questions || [])
  const [errors, setErrors] = useState<string[]>([])

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: crypto.randomUUID(),
        text: '',
        choices: [],
        correctChoice: 0,
        order: questions.length,
      },
    ])
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
    setQuestions(copy)
  }

  const validate = () => {
    const errs: string[] = []
    if (!name.trim()) errs.push('Quiz name required')
    if (questions.length === 0) errs.push('At least one question')
    questions.forEach((q, i) => {
      if (q.choices.length < 2 || q.choices.length > 4) {
        errs.push(`Question ${i + 1} must have 2-4 choices`)
      }
    })
    setErrors(errs)
    return errs.length === 0
  }

  const handleExport = async () => {
    const json = await exportQuiz({ id: quiz.id, name, description, questions })
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quiz.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    const data = await importQuiz(text)
    setName(data.name)
    setDescription(data.description || '')
    setQuestions(data.questions)
  }

  const onSubmit = () => {
    if (!validate()) return
    // TODO: submit to backend
    console.log('submit', { name, description, questions })
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit Quiz</TabsTrigger>
          <TabsTrigger value="import">Import/Export</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quiz name" />
              <textarea
                className="border rounded-md w-full p-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            </CardContent>
          </Card>
          {questions.map((q, idx) => (
            <Card key={q.id} className="space-y-2">
              <CardHeader>
                <CardTitle>Question {idx + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  value={q.text}
                  onChange={(e) => updateQuestionText(idx, e.target.value)}
                  placeholder="Question text"
                />
                {q.choices.map((c, cIdx) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Input
                      value={c.text}
                      onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                      placeholder={`Choice ${cIdx + 1}`}
                    />
                    <Button type="button" variant="outline" onClick={() => removeChoice(idx, cIdx)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" onClick={() => addChoice(idx)} disabled={q.choices.length >= 4}>
                  Add Choice
                </Button>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleAudio(idx, 'prompt', e.target.files?.[0] || null)}
                  />
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleAudio(idx, 'reveal', e.target.files?.[0] || null)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" onClick={handleAddQuestion}>
            Add Question
          </Button>
          {errors.length > 0 && (
            <Card className="border-destructive">
              <CardContent className="text-destructive space-y-1">
                {errors.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </CardContent>
            </Card>
          )}
          <Button onClick={onSubmit}>Save Quiz</Button>
        </TabsContent>
        <TabsContent value="import" className="space-y-4">
          <div className="flex items-center gap-2">
            <input type="file" accept="application/json" onChange={(e) => handleImport(e.target.files?.[0] || null)} />
            <Button type="button" onClick={handleExport}>
              Export
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
