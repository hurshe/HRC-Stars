import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Award, Download } from 'lucide-react'
import type { CurrentUser } from '@/server/auth/session'
import { listUserEnrollments } from '@/server/services/programs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ProgressBar } from './progress-bar'

/// Карточка в профиле сотрудника: его программы, прогресс и выданные сертификаты.
/// Сертификат «лежит в профиле» — ровно так он и был описан в плане
export async function EmployeePrograms({ actor, userId }: { actor: CurrentUser; userId: string }) {
  const enrollments = await listUserEnrollments(actor, userId)
  const t = await getTranslations('programs')

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Award className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="font-display text-lg font-bold text-foreground">{t('profile.title')}</h2>
      </div>

      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('profile.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {enrollments.map((enrollment) => {
            const completed = Boolean(enrollment.completedAt)
            return (
              <li
                key={enrollment.id}
                className="space-y-1.5 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/programs/enrollments/${enrollment.id}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {enrollment.program.name}
                  </Link>
                  <Badge tone={completed ? 'gold' : enrollment.overdue ? 'danger' : 'info'}>
                    {completed
                      ? t('status.completed')
                      : enrollment.overdue
                        ? t('status.overdue')
                        : t('status.inProgress')}
                  </Badge>
                </div>
                <ProgressBar
                  percent={enrollment.progress.percent}
                  completed={completed}
                  label={t('progressLabel')}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {t('progress', {
                      done: enrollment.progress.requiredDone,
                      total: enrollment.progress.requiredTotal,
                    })}
                  </span>
                  {enrollment.certificate && (
                    <a
                      href={`/api/certificates/${enrollment.certificate.id}/download`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                    >
                      <Download className="size-3.5" aria-hidden />
                      {enrollment.certificate.number}
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
