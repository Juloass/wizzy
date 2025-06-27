import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface Props { params: { id: string } }

export async function PUT(req: Request, { params }: Props) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await req.json()
  const { name, description, questions } = data

  const existing = await prisma.quiz.findUnique({
    where: { id: params.id },
    select: { ownerId: true },
  })

  if (!existing)
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  if (existing.ownerId !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.question.deleteMany({ where: { quizId: params.id } })

  const quiz = await prisma.quiz.update({
    where: { id: params.id },
    data: {
      name,
      description,
      questions: {
        create: questions.map((q: any, idx: number) => ({
          text: q.text,
          audioPromptKey: q.audioPromptKey,
          audioRevealKey: q.audioRevealKey,
          correctChoice: q.correctChoice,
          order: idx,
          choices: {
            create: q.choices.map((c: any) => ({ text: c.text, index: c.index })),
          },
        })),
      },
    },
  })

  return NextResponse.json({ id: quiz.id })
}

