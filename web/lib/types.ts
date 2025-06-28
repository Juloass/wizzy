import type { Prisma } from '@wizzy/prisma'

// Prisma models with related questions and choices
export type QuizWithQuestions = Prisma.QuizGetPayload<{
  include: { questions: { include: { choices: true } } }
}>

export type QuestionWithChoices = Prisma.QuestionGetPayload<{
  include: { choices: true }
}>

// Payload shapes for API requests
export type ChoicePayload = Omit<Prisma.Choice, 'id' | 'questionId'> & {
  id?: string
}
export type QuestionPayload =
  Omit<Prisma.Question, 'id' | 'quizId'> & {
    id?: string
    choices: ChoicePayload[]
  }
export type QuizPayload =
  Omit<Prisma.Quiz, 'id' | 'ownerId' | 'createdAt'> & {
    id?: string
    questions: QuestionPayload[]
  }
