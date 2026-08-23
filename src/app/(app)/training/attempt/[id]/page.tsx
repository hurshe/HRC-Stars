import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth/session'
import { getAttempt } from '@/server/services/tests'
import { AttemptRunner } from './attempt-runner'

export default async function AttemptPage({ params }: PageProps<'/training/attempt/[id]'>) {
  const actor = await requireUser()
  const { id } = await params

  const attempt = await getAttempt(actor, id)
  if (!attempt) notFound()

  return (
    <AttemptRunner
      attemptId={attempt.id}
      status={attempt.status}
      testTitle={attempt.testVersion.test.title}
      timeLimitMinutes={attempt.testVersion.timeLimitMinutes}
      startedAt={attempt.startedAt.toISOString()}
      maxScore={attempt.testVersion.maxScore}
      threshold={attempt.appliedThreshold}
      result={
        attempt.status === 'SUBMITTED'
          ? { score: attempt.score, percent: attempt.percent, passed: attempt.passed }
          : null
      }
      questions={attempt.testVersion.questions.map((link) => ({
        id: link.question.id,
        type: link.question.type,
        text: link.question.text,
        options: (link.question.options ?? []) as string[],
        points: link.points,
      }))}
      // Ответы отправленной попытки показываем в разборе
      answers={Object.fromEntries(
        attempt.answers.map((answer) => [
          answer.questionId,
          { value: answer.value, isCorrect: answer.isCorrect },
        ]),
      )}
    />
  )
}
