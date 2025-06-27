import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const data = await req.json()
  const { name, description, questions } = data
  const quiz = await prisma.quiz.create({
    data: {
      name,
      description,
      ownerId: user.id,
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

