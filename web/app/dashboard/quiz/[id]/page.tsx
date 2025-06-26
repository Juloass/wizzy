import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import QuizForm from '@/components/quiz-form';

interface Props { params: { id: string } }

export default async function QuizPage({ params }: Props) {
  const { id } = await params; // 👈 destructure AVANT usage
  const user = await getCurrentUser();
  if (!user) return null;

  const quiz = await prisma.quiz.findFirst({
    where: { id, ownerId: user.id },
    include: {
      questions: { include: { choices: true }, orderBy: { order: "asc" } },
    },
  });

  if (!quiz) return notFound();
  return <QuizForm quiz={quiz} />;
}
