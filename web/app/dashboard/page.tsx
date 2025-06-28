import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import ErrorScreen from '@/components/error-screen'
import { tryWithError } from '@/lib/try-with-error'

export default async function DashboardPage() {
  const [user, userError] = await tryWithError(() => getCurrentUser())
  if (userError) return <ErrorScreen title="Database Unreachable" />
  if (!user) return null

  const [quizzes, quizError] = await tryWithError(() =>
    prisma.quiz.findMany({ where: { ownerId: user.id } })
  )
  if (quizError) return <ErrorScreen title="Database Unreachable" />

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Your Quizzes</h1>
      <Link className="underline" href="/dashboard/quiz/new">Create New Quiz</Link>
      <ul className="mt-4 space-y-2">
        {quizzes.map((q) => (
          <li key={q.id}>
            <Link className="text-purple-600 underline" href={`/dashboard/quiz/${q.id}`}>{q.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
