import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import type { QuizPayload } from '@/lib/types'

interface Props { params: { id: string } }

export async function PUT(req: Request, { params }: Props) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = (await req.json()) as QuizPayload
  const { name, description, questions } = data

  const existing = await prisma.quiz.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing)
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  if (existing.ownerId !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.choice.deleteMany({ where: { question: { quizId: id } } })
  await prisma.question.deleteMany({ where: { quizId: id } })

  const quiz = await prisma.quiz.update({
    where: { id },
    data: {
      name,
      description,
      questions: {
        create: questions.map((q, idx) => ({
          text: q.text,
          audioPromptKey: q.audioPromptKey,
          audioRevealKey: q.audioRevealKey,
          imageKey: q.imageKey,
          correctChoice: q.correctChoice,
          order: idx,
          choices: {
            create: q.choices.map((c) => ({ text: c.text, index: c.index })),
          },
        })),
      },
    },
  })

  return NextResponse.json({ id: quiz.id })
}

