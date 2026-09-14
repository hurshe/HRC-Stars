import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { ArrowLeft, CheckCircle2, Circle, Download, TriangleAlert } from 'lucide-react'
import { getPermissions, requireUser } from '@/server/auth/session'
import { getEnrollment } from '@/server/services/programs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StartTestButton } from '@/app/(app)/training/my/start-test-button'
import { ProgressBar } from '../../progress-bar'
import {
  AcknowledgeStepButton,
  CancelEnrollmentButton,
  IssueCertificateButton,
  PracticeToggle,
} from './enrollment-panels'

export default async function EnrollmentPage({ params }: PageProps<'/programs/enrollments/[id]'>) {
  const actor = await requireUser()
  const { id } = await params

  // Доступ проверяет сервис: участник, куратор или человек с правом на программы
  const enrollment = await getEnrollment(actor, id)
  if (!enrollment) notFound()

  const permissions = await getPermissions(actor.id)
  const format = await getFormatter()
  const t = await getTranslations('programs')

  const completed = Boolean(enrollment.completedAt)
  const backHref = permissions.has('program.view') ? `/programs/${enrollment.programId}` : '/programs'
  const date = (value: Date) => format.dateTime(value, { dateStyle: 'medium' })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('enrollment.back')}
        </Link>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {enrollment.user.firstName} {enrollment.user.lastName}
            </p>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {enrollment.program.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {enrollment.mentor
                ? t('mentor', {
                    name: `${enrollment.mentor.firstName} ${enrollment.mentor.lastName}`,
                  })
                : t('noMentor')}
              {' · '}
              {t('enrollment.startedAt')}: {date(enrollment.startedAt)}
              {enrollment.dueAt && !completed && <> · {t('due', { date: date(enrollment.dueAt) })}</>}
            </p>
          </div>
          <Badge tone={completed ? 'gold' : enrollment.overdue ? 'danger' : 'info'} size="md">
            {completed
              ? t('status.completed')
              : enrollment.overdue
                ? t('status.overdue')
                : t('status.inProgress')}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <ProgressBar
            percent={enrollment.progress.percent}
            completed={completed}
            label={t('progressLabel')}
          />
          <p className="text-xs text-muted-foreground">
            {t('progress', {
              done: enrollment.progress.requiredDone,
              total: enrollment.progress.requiredTotal,
            })}
          </p>
        </div>

        {enrollment.certificate && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-control) border border-gold/50 bg-gold/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t('enrollment.issued')}</p>
              <p className="font-mono text-sm text-muted-foreground">
                {enrollment.certificate.number} · {date(enrollment.certificate.issuedAt)}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a
                href={`/api/certificates/${enrollment.certificate.id}/download`}
                target="_blank"
                rel="noopener"
              >
                <Download className="size-4" aria-hidden />
                {t('enrollment.download')}
              </a>
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('detail.steps')}</h2>

        {enrollment.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noSteps')}</p>
        ) : (
          <ol className="space-y-2">
            {enrollment.steps.map((step, index) => {
              const open = !step.done && !step.unavailable && !completed
              const canRead = step.type === 'DOCUMENT' && step.refId && !step.unavailable
              const canAcknowledge = step.type === 'DOCUMENT' && enrollment.isParticipant && open
              const canTakeTest =
                step.type === 'TEST' && step.refId && enrollment.isParticipant && open
              const canVerify = step.type === 'PRACTICE' && enrollment.canVerifyPractice
              const hasActions = canRead || canAcknowledge || canTakeTest || canVerify

              return (
                <li
                  key={step.id}
                  className="space-y-2 rounded-(--radius-control) border border-border px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    {step.done ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    ) : step.unavailable ? (
                      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">
                          {index + 1}. {step.title}
                        </span>
                        <Badge variant="outline" size="sm">
                          {t(`stepType.${step.type}`)}
                        </Badge>
                        {!step.required && <Badge size="sm">{t('detail.optional')}</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.done && step.doneAt
                          ? t('enrollment.stepDone', { date: date(step.doneAt) })
                          : step.unavailable
                            ? t('errors.unavailable')
                            : t('enrollment.stepPending')}
                        {step.verifiedBy && (
                          <> · {t('enrollment.verifiedBy', { name: step.verifiedBy })}</>
                        )}
                      </p>
                      {step.type === 'PRACTICE' && !step.done && enrollment.isParticipant && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t('enrollment.practiceHint')}
                        </p>
                      )}
                    </div>
                  </div>

                  {hasActions && (
                    <div className="flex flex-wrap gap-2 pl-8">
                      {canRead && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/documents/${step.refId}`}>{t('enrollment.openDocument')}</Link>
                        </Button>
                      )}
                      {canAcknowledge && (
                        <AcknowledgeStepButton enrollmentId={enrollment.id} stepId={step.id} />
                      )}
                      {canTakeTest && step.refId && <StartTestButton testId={step.refId} />}
                      {canVerify && (
                        <PracticeToggle
                          enrollmentId={enrollment.id}
                          stepId={step.id}
                          done={step.done}
                        />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      {(enrollment.canIssue || enrollment.canCancel) && (
        <Card className="flex flex-wrap items-start justify-between gap-3 p-5">
          {enrollment.canIssue ? (
            <IssueCertificateButton enrollmentId={enrollment.id} ready={enrollment.progress.ready} />
          ) : (
            <span />
          )}
          {enrollment.canCancel && <CancelEnrollmentButton enrollmentId={enrollment.id} />}
        </Card>
      )}
    </div>
  )
}
