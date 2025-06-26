import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const quizzes = await prisma.quiz.findMany({ where: { ownerId: user.id } });
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
