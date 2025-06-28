import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import QuizForm from '@/components/quiz-form'
import ErrorScreen from '@/components/error-screen'
import { tryWithError } from '@/lib/try-with-error'

interface Props { params: { id: string } }

export default async function QuizPage({ params }: Props) {
  const { id } = await params;
  const [user, userError] = await tryWithError(() => getCurrentUser())
  if (userError) return <ErrorScreen title="Database Unreachable" />
  if (!user) return null

  const [quiz, quizError] = await tryWithError(() =>
    prisma.quiz.findFirst({
      where: { id, ownerId: user.id },
      include: {
        questions: { include: { choices: true }, orderBy: { order: 'asc' } },
      },
    })
  )
  if (quizError) return <ErrorScreen title="Database Unreachable" />

  if (!quiz) return notFound();
  return <QuizForm quiz={quiz} />;
}
