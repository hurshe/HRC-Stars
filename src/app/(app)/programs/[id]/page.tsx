import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { getProgram, getProgramFormOptions } from '@/server/services/programs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { PROGRAM_TYPE_TONES } from '../all/page'
import { ProgressBar } from '../progress-bar'
import { AddStepForm, EnrollForm, ProgramActiveToggle, StepControls } from './program-panels'

export default async function ProgramPage({ params }: PageProps<'/programs/[id]'>) {
  const actor = await requirePermission('program.view')
  const { id } = await params

  const program = await getProgram(actor, id)
  if (!program) notFound()

  const permissions = await getPermissions(actor.id)
  const canManage = permissions.has('program.manage')
  const canEnroll = permissions.has('program.enroll') && program.isActive
  const options = canManage || canEnroll ? await getProgramFormOptions(actor) : null

  const locale = await getLocale()
  const format = await getFormatter()
  const t = await getTranslations('programs')

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/programs/all"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('tabs.all')}
        </Link>
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">{program.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={PROGRAM_TYPE_TONES[program.type]}>{t(`type.${program.type}`)}</Badge>
              {program.position && (
                <Badge variant="outline">
                  {locale === 'pl' ? program.position.namePl : program.position.nameEn}
                </Badge>
              )}
              {!program.isActive && <Badge>{t('status.archived')}</Badge>}
            </div>
            {program.description && (
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                {program.description}
              </p>
            )}
          </div>
          {canManage && <ProgramActiveToggle programId={program.id} isActive={program.isActive} />}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="font-display text-lg font-bold text-foreground">{t('detail.steps')}</h2>

        {program.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noSteps')}</p>
        ) : (
          <ol className="space-y-2">
            {program.steps.map((step, index) => (
              <li
                key={step.id}
                className="flex flex-wrap items-center gap-3 rounded-(--radius-control) border border-border px-3 py-2"
              >
                <span className="w-6 text-center font-display text-sm font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" size="sm">
                      {t(`stepType.${step.type}`)}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{step.title}</span>
                    {!step.required && <Badge size="sm">{t('detail.optional')}</Badge>}
                  </div>
                  {step.unavailable && (
                    <p className="mt-0.5 text-xs text-danger">{t('detail.unavailable')}</p>
                  )}
                </div>
                {canManage && (
                  <StepControls
                    stepId={step.id}
                    isFirst={index === 0}
                    isLast={index === program.steps.length - 1}
                  />
                )}
              </li>
            ))}
          </ol>
        )}

        {canManage && options && (
          <AddStepForm programId={program.id} documents={options.documents} tests={options.tests} />
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">{t('detail.participants')}</h2>

        {program.enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('detail.noParticipants')}</p>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>{t('detail.participant')}</TH>
                  <TH>{t('detail.mentor')}</TH>
                  <TH>{t('detail.startedAt')}</TH>
                  <TH className="min-w-40">{t('detail.progress')}</TH>
                  <TH>{t('detail.status')}</TH>
                </TR>
              </THead>
              <TBody>
                {program.enrollments.map((enrollment) => {
                  const completed = Boolean(enrollment.completedAt)
                  return (
                    <TR key={enrollment.id}>
                      <TD>
                        <Link
                          href={`/programs/enrollments/${enrollment.id}`}
                          className="font-medium hover:underline"
                        >
                          {enrollment.user.firstName} {enrollment.user.lastName}
                        </Link>
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {enrollment.mentor
                          ? `${enrollment.mentor.firstName} ${enrollment.mentor.lastName}`
                          : '—'}
                      </TD>
                      <TD className="text-sm text-muted-foreground">
                        {format.dateTime(enrollment.startedAt, { dateStyle: 'medium' })}
                      </TD>
                      <TD>
                        <div className="space-y-1">
                          <ProgressBar
                            percent={enrollment.progress.percent}
                            completed={completed}
                            label={t('progressLabel')}
                          />
                          <span className="text-xs text-muted-foreground">
                            {enrollment.progress.requiredDone}/{enrollment.progress.requiredTotal}
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <Badge tone={completed ? 'gold' : enrollment.overdue ? 'danger' : 'info'}>
                          {completed
                            ? t('status.completed')
                            : enrollment.overdue
                              ? t('status.overdue')
                              : t('status.inProgress')}
                        </Badge>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableWrapper>
        )}

        {!program.isActive && (
          <p className="text-sm text-muted-foreground">{t('detail.archivedNotice')}</p>
        )}

        {canEnroll && options && (
          <EnrollForm
            programId={program.id}
            participants={options.participants}
            mentors={options.mentors}
          />
        )}
      </section>
    </div>
  )
}
