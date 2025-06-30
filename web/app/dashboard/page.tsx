import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import ErrorScreen from '@/components/error-screen'
import { tryWithError } from '@/lib/try-with-error'
import StartQuizForm from '@/components/start-quiz-form'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const [user, userError] = await tryWithError(() => getCurrentUser())
  if (userError) return <ErrorScreen title="Database Unreachable" />
  if (!user) return null

  const [quizzes, quizError] = await tryWithError(() =>
    prisma.quiz.findMany({ where: { ownerId: user.id } })
  )
  if (quizError) return <ErrorScreen title="Database Unreachable" />

  return (
    <main className="p-8 mx-auto max-w-4xl">
      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h1 className="text-xl font-bold tracking-tight mb-4">Your Quizzes</h1>
          <Button asChild className="mb-4">
            <Link href="/dashboard/quiz/new">Create New Quiz</Link>
          </Button>
          <ul className="space-y-3">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <Link href={`/dashboard/quiz/${q.id}`} className="font-medium">
                      {q.name}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-bold tracking-tight mb-4">Create Room</h2>
          <StartQuizForm quizzes={quizzes} accessToken={user.accessToken || ''} />
        </section>
      </div>
    </main>
  );
}
