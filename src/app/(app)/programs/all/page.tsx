import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Award, Plus } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { listPrograms } from '@/server/services/programs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { ProgramsTabs } from '../programs-tabs'

export const PROGRAM_TYPE_TONES = { ONBOARDING: 'info', MIT: 'gold', CUSTOM: 'neutral' } as const

export default async function AllProgramsPage() {
  const actor = await requirePermission('program.view')
  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const t = await getTranslations('programs')

  const programs = await listPrograms(actor)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {permissions.has('program.manage') && (
          <Button asChild>
            <Link href="/programs/new">
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          </Button>
        )}
      </div>

      <ProgramsTabs
        canSeePrograms
        canSeeCertificates={permissions.has('certificate.view')}
      />

      {programs.length === 0 ? (
        <TableWrapper>
          <EmptyState
            icon={<Award className="size-8" aria-hidden />}
            title={t('all.empty.title')}
            description={t('all.empty.description')}
          />
        </TableWrapper>
      ) : (
        <TableWrapper>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{t('all.table.name')}</TH>
                <TH>{t('all.table.type')}</TH>
                <TH>{t('all.table.position')}</TH>
                <TH>{t('all.table.steps')}</TH>
                <TH>{t('all.table.enrollments')}</TH>
                <TH>{t('all.table.certificates')}</TH>
                <TH>{t('all.table.status')}</TH>
              </TR>
            </THead>
            <TBody>
              {programs.map((program) => (
                <TR key={program.id}>
                  <TD>
                    <Link href={`/programs/${program.id}`} className="font-medium hover:underline">
                      {program.name}
                    </Link>
                    {program.description && (
                      <div className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                        {program.description}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={PROGRAM_TYPE_TONES[program.type]} size="sm">
                      {t(`type.${program.type}`)}
                    </Badge>
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {program.position
                      ? locale === 'pl'
                        ? program.position.namePl
                        : program.position.nameEn
                      : '—'}
                  </TD>
                  <TD className="text-sm text-muted-foreground">{program._count.steps}</TD>
                  <TD className="text-sm text-muted-foreground">{program._count.enrollments}</TD>
                  <TD className="text-sm text-muted-foreground">{program._count.certificates}</TD>
                  <TD>
                    <Badge tone={program.isActive ? 'success' : 'neutral'}>
                      {program.isActive ? t('status.active') : t('status.archived')}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  )
}
