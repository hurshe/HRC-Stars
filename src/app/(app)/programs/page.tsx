import { getTranslations } from 'next-intl/server'
import { Award } from 'lucide-react'
import { getPermissions, requireUser } from '@/server/auth/session'
import { listUserEnrollments } from '@/server/services/programs'
import { EmptyState, TableWrapper } from '@/components/ui/table'
import { EnrollmentCard } from './enrollment-card'
import { ProgramsTabs } from './programs-tabs'

/// «Мои программы» доступны любому сотруднику: собственное обучение
/// правами не регулируется, как и собственные тесты
export default async function MyProgramsPage() {
  const actor = await requireUser()
  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('programs')

  const enrollments = await listUserEnrollments(actor, actor.id)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProgramsTabs
        canSeePrograms={permissions.has('program.view')}
        canSeeCertificates={permissions.has('certificate.view')}
      />

      {enrollments.length === 0 ? (
        <TableWrapper>
          <EmptyState
            icon={<Award className="size-8" aria-hidden />}
            title={t('my.empty.title')}
            description={t('my.empty.description')}
          />
        </TableWrapper>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {enrollments.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      )}
    </div>
  )
}
