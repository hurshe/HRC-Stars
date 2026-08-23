'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { submitAttemptAction } from '../../actions'

type Question = {
  id: string
  type: string
  text: string
  options: string[]
  points: number
}

type Result = { score: number | null; percent: number | null; passed: boolean | null }

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function AttemptRunner({
  attemptId,
  status,
  testTitle,
  timeLimitMinutes,
  startedAt,
  maxScore,
  threshold,
  result,
  questions,
  answers,
}: {
  attemptId: string
  status: string
  testTitle: string
  timeLimitMinutes: number | null
  startedAt: string
  maxScore: number
  threshold: number | null
  result: Result | null
  questions: Question[]
  answers: Record<string, { value: unknown; isCorrect: boolean | null }>
}) {
  const t = useTranslations('training.attempt')
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [given, setGiven] = useState<Record<string, unknown>>({})
  const [pending, startTransition] = useTransition()
  const submitted = status === 'SUBMITTED'

  const deadline = useMemo(() => {
    if (!timeLimitMinutes) return null
    return new Date(startedAt).getTime() + timeLimitMinutes * 60_000
  }, [startedAt, timeLimitMinutes])

  // Начальное значение берём из длительности теста, а не из текущего времени:
  // Date.now() во время рендера — нечистая функция, и результат может
  // разойтись между сервером и клиентом. Первый тик через секунду уточнит
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    timeLimitMinutes ? timeLimitMinutes * 60 : null,
  )

  // Ответы дублируются в ref, чтобы таймер мог отправить актуальные данные
  // и при этом не пересоздавался на каждое нажатие. Синхронизация идёт
  // в эффекте: писать в ref во время рендера нельзя
  const givenRef = useRef<Record<string, unknown>>({})

  useEffect(() => {
    givenRef.current = given
  }, [given])

  function submit() {
    startTransition(async () => {
      await submitAttemptAction(attemptId, givenRef.current)
      router.refresh()
    })
  }

  // Когда время вышло, попытка отправляется сама с тем, что успели
  // ответить, — иначе результат работы просто пропал бы
  useEffect(() => {
    if (!deadline || submitted) return

    const timer = setInterval(() => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        clearInterval(timer)
        startTransition(async () => {
          await submitAttemptAction(attemptId, givenRef.current)
          router.refresh()
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [deadline, submitted, attemptId, router])

  if (submitted && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card className="space-y-3 p-6 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">{testTitle}</h1>
          <div className="font-display text-5xl font-bold text-foreground">{result.percent}%</div>
          <Badge tone={result.passed ? 'success' : 'danger'} variant="solid" size="md">
            {result.passed ? t('passed') : t('failed')}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {t('scoreLine', { score: result.score ?? 0, max: maxScore })}
          </p>
          {threshold != null && (
            <p className="text-xs text-muted-foreground">{t('threshold', { threshold })}</p>
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-foreground">{t('review')}</h2>
          <ol className="space-y-2">
            {questions.map((question, position) => {
              const answer = answers[question.id]
              return (
                <li
                  key={question.id}
                  className="rounded-(--radius-control) border border-border px-3 py-2"
                >
                  <div className="flex items-start gap-2">
                    {answer?.isCorrect ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {position + 1}. {question.text}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t('yourAnswer')}:{' '}
                        {Array.isArray(answer?.value)
                          ? (answer.value as unknown[])
                              .map((item) => question.options[Number(item)] ?? String(item))
                              .join(', ')
                          : (question.options[Number(answer?.value)] ?? String(answer?.value ?? '—'))}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <Button asChild variant="outline">
            <Link href="/training/my">{t('backToList')}</Link>
          </Button>
        </Card>
      </div>
    )
  }

  const question = questions[index]
  if (!question) return null

  const value = given[question.id]

  function setValue(next: unknown) {
    setGiven({ ...given, [question.id]: next })
  }

  function toggleMultiple(optionIndex: string) {
    const current = Array.isArray(value) ? (value as string[]) : []
    setValue(
      current.includes(optionIndex)
        ? current.filter((item) => item !== optionIndex)
        : [...current, optionIndex],
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-foreground">{testTitle}</h1>
        {secondsLeft != null && (
          <Badge tone={secondsLeft < 60 ? 'danger' : 'neutral'} size="md">
            {t('timeLeft', { time: formatTime(secondsLeft) })}
          </Badge>
        )}
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <Card className="space-y-4 p-5">
        <div className="text-xs text-muted-foreground">
          {t('question', { current: index + 1, total: questions.length })}
        </div>
        <p className="text-base font-medium text-foreground">{question.text}</p>

        <div className="space-y-2">
          {question.type === 'SHORT_TEXT' ? (
            <Input
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          ) : question.type === 'TRUE_FALSE' ? (
            ['true', 'false'].map((option) => (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3 py-3 text-sm',
                  value === option ? 'border-primary bg-primary/10' : 'border-border',
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={value === option}
                  onChange={() => setValue(option)}
                  className="size-4 accent-[var(--primary)]"
                />
                {option}
              </label>
            ))
          ) : (
            question.options.map((option, optionIndex) => {
              const key = String(optionIndex)
              const multiple = question.type === 'MULTIPLE_CHOICE'
              const checked = multiple
                ? Array.isArray(value) && (value as string[]).includes(key)
                : value === key

              return (
                <label
                  key={key}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-(--radius-control) border px-3 py-3 text-sm',
                    checked ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                >
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={question.id}
                    checked={checked}
                    onChange={() => (multiple ? toggleMultiple(key) : setValue(key))}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span className="text-foreground">{option}</span>
                </label>
              )
            })
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((current) => current - 1)}
        >
          {t('previous')}
        </Button>

        {index === questions.length - 1 ? (
          <Button loading={pending} onClick={submit}>
            {t('finish')}
          </Button>
        ) : (
          <Button onClick={() => setIndex((current) => current + 1)}>{t('next')}</Button>
        )}
      </div>
    </div>
  )
}
