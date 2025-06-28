import { getCurrentUser } from '@/lib/auth'
import QuizForm from '@/components/quiz-form'
import ErrorScreen from '@/components/error-screen'
import { tryWithError } from '@/lib/try-with-error'

export default async function NewQuizPage() {
  const [user, userError] = await tryWithError(() => getCurrentUser())
  if (userError) return <ErrorScreen title="Database Unreachable" />
  if (!user) return null

  const quiz = { id: '', name: '', description: '', questions: [] };

  return <QuizForm quiz={quiz} />;
}
