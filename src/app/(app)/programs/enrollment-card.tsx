import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Download } from 'lucide-react'
import type { ProgramType } from '@prisma/client'
import type { ProgressSummary } from '@/server/services/programs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProgressBar } from './progress-bar'

export type EnrollmentCardData = {
  id: string
  completedAt: Date | null
  dueAt: Date | null
  overdue: boolean
  program: { name: string; type: ProgramType }
  mentor: { firstName: string; lastName: string } | null
  progress: ProgressSummary
  certificate: { id: string; number: string } | null
}

export async function EnrollmentCard({ enrollment }: { enrollment: EnrollmentCardData }) {
  const t = await getTranslations('programs')
  const format = await getFormatter()
  const completed = Boolean(enrollment.completedAt)

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/programs/enrollments/${enrollment.id}`}
            className="font-display text-lg font-bold text-foreground hover:underline"
          >
            {enrollment.program.name}
          </Link>
          <p className="text-xs text-muted-foreground">
            {enrollment.mentor
              ? t('mentor', { name: `${enrollment.mentor.firstName} ${enrollment.mentor.lastName}` })
              : t('noMentor')}
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
          {enrollment.dueAt && !completed && (
            <> · {t('due', { date: format.dateTime(enrollment.dueAt, { dateStyle: 'medium' }) })}</>
          )}
        </p>
      </div>

      {enrollment.certificate && (
        <a
          href={`/api/certificates/${enrollment.certificate.id}/download`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
        >
          <Download className="size-4" aria-hidden />
          {t('enrollment.certificate', { number: enrollment.certificate.number })}
        </a>
      )}
    </Card>
  )
}
