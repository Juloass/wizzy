import { getCurrentUser } from '@/lib/auth';
import QuizForm from '@/components/quiz-form';

export default async function NewQuizPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const quiz = { id: '', name: '', description: '', questions: [] };

  return <QuizForm quiz={quiz} />;
}
