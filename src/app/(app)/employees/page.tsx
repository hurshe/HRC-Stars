import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Plus, Users } from 'lucide-react'
import { db } from '@/lib/db'
import { employeeFiltersSchema } from '@/lib/employee-schema'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { listEmployees } from '@/server/services/employees'
import { Badge, toneForStatus } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableWrapper,
} from '@/components/ui/table'
import { EmployeeFilters } from './employee-filters'

export default async function EmployeesPage({ searchParams }: PageProps<'/employees'>) {
  const actor = await requirePermission('employee.view')
  const permissions = await getPermissions(actor.id)
  const locale = await getLocale()
  const t = await getTranslations('employees')

  const params = await searchParams
  // Мусор в адресной строке не должен ронять страницу: невалидные значения
  // просто отбрасываются и работают значения по умолчанию
  const parsed = employeeFiltersSchema.safeParse(params)
  const filters = parsed.success ? parsed.data : employeeFiltersSchema.parse({})

  const [{ items, total, page, pageCount }, positions] = await Promise.all([
    listEmployees(actor, filters),
    db.position.findMany({
      where: { isActive: true },
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true, code: true, nameEn: true, namePl: true },
    }),
  ])

  const canCreate = permissions.has('employee.create')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/employees/new">
              <Plus className="size-4" aria-hidden />
              {t('add')}
            </Link>
          </Button>
        )}
      </div>

      <EmployeeFilters positions={positions} locale={locale} />

      <p className="text-sm text-muted-foreground">{t('results', { count: total })}</p>

      {items.length === 0 ? (
        <TableWrapper>
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/employees/new">{t('add')}</Link>
                </Button>
              ) : undefined
            }
          />
        </TableWrapper>
      ) : (
        <TableWrapper>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{t('table.name')}</TH>
                <TH>{t('table.number')}</TH>
                <TH>{t('table.positions')}</TH>
                <TH>{t('table.role')}</TH>
                <TH>{t('table.status')}</TH>
                <TH className="w-0" />
              </TR>
            </THead>
            <TBody>
              {items.map((employee) => (
                <TR key={employee.id}>
                  <TD>
                    <Link
                      href={`/employees/${employee.id}`}
                      className="font-medium hover:underline"
                    >
                      {employee.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{employee.email}</div>
                  </TD>
                  <TD className="font-mono text-xs text-muted-foreground">
                    {employee.employeeNumber ?? '—'}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      {employee.positions.map((position) => (
                        <Badge key={position.code} variant="outline">
                          {locale === 'pl' ? position.namePl : position.nameEn}
                        </Badge>
                      ))}
                      {employee.isTrainer && (
                        <Badge tone="gold" variant="soft">
                          TRAINER
                        </Badge>
                      )}
                    </div>
                  </TD>
                  <TD className="text-xs text-muted-foreground">{employee.roleCode}</TD>
                  <TD>
                    <Badge tone={toneForStatus(employee.status)}>
                      {t(`status.${employee.status}`)}
                    </Badge>
                  </TD>
                  <TD>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/employees/${employee.id}`}>{t('table.open')}</Link>
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => {
            const next = new URLSearchParams(
              Object.entries(params).flatMap(([key, value]) =>
                typeof value === 'string' ? [[key, value] as [string, string]] : [],
              ),
            )
            next.set('page', String(number))
            return (
              <Button
                key={number}
                asChild
                size="sm"
                variant={number === page ? 'primary' : 'outline'}
              >
                <Link href={`/employees?${next}`} aria-current={number === page ? 'page' : undefined}>
                  {number}
                </Link>
              </Button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
