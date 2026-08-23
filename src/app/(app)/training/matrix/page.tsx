import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/server/auth/session'
import { cellKey, getTrainingMatrix } from '@/server/services/training-matrix'
import { Badge, toneForScore, toneForStatus } from '@/components/ui/badge'
import { EmptyState, TableWrapper } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { MatrixFilter } from './matrix-filter'

/// Статусы документов раскрашиваются по смыслу: «ждём оригинал» —
/// это не ошибка, а промежуточное состояние, и красным оно быть не должно
const DOC_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  UPLOADED: 'success',
  PAPER: 'success',
  INCOMING: 'warning',
  MISSING: 'neutral',
  EXPIRED: 'danger',
}

export default async function MatrixPage({ searchParams }: PageProps<'/training/matrix'>) {
  const actor = await requirePermission('test.result.view')
  const locale = await getLocale()
  const t = await getTranslations('training.matrix')
  const tEmployees = await getTranslations('employees')

  const params = await searchParams
  const positionId = typeof params.positionId === 'string' ? params.positionId : undefined

  const [matrix, positions] = await Promise.all([
    getTrainingMatrix(actor, { positionId }),
    db.position.findMany({
      where: { isActive: true },
      orderBy: [{ department: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      select: { id: true, nameEn: true, namePl: true },
    }),
  ])

  const columnCount = matrix.tests.length + matrix.requirements.length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <MatrixFilter positions={positions} locale={locale} />

      <p className="text-xs text-muted-foreground">{t('legend')}</p>

      {matrix.employees.length === 0 ? (
        <TableWrapper>
          <EmptyState title={t('empty')} />
        </TableWrapper>
      ) : (
        <TableWrapper>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {/* Колонка с именем прилипает к левому краю: при десятке
                    тестов иначе непонятно, чью строку читаешь */}
                <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t('employee')}
                </th>
                {matrix.tests.map((test) => (
                  <th
                    key={test.id}
                    className="min-w-24 px-2 py-3 text-center text-xs font-medium text-muted-foreground"
                    title={test.title}
                  >
                    <span className="line-clamp-2">{test.title}</span>
                  </th>
                ))}
                {matrix.requirements.map((requirement) => (
                  <th
                    key={requirement.id}
                    className="min-w-24 px-2 py-3 text-center text-xs font-medium text-muted-foreground"
                    title={requirement.name}
                  >
                    <span className="line-clamp-2">{requirement.name}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {matrix.employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-muted/40">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal"
                  >
                    <Link
                      href={`/employees/${employee.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {employee.fullName}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="uppercase">{employee.positions.join(' · ')}</span>
                      {employee.isTrainer && <span className="text-gold">TRAINER</span>}
                    </div>
                    {employee.status !== 'ACTIVE' && (
                      <Badge tone={toneForStatus(employee.status)} size="sm">
                        {tEmployees(`status.${employee.status}`)}
                      </Badge>
                    )}
                  </th>

                  {matrix.tests.map((test) => {
                    const cell = matrix.testCells[cellKey(employee.id, test.id)]
                    return (
                      <td key={test.id} className="px-2 py-2 text-center">
                        {cell?.percent == null ? (
                          <span className="text-muted-foreground/50">{t('noData')}</span>
                        ) : (
                          <span
                            className="inline-flex flex-col items-center gap-0.5"
                            title={`${cell.score ?? '?'} / ${cell.maxScore}${cell.mode === 'PAPER' ? ' · paper' : ''}`}
                          >
                            <Badge
                              tone={toneForScore(cell.percent, matrix.bands)}
                              variant="solid"
                              size="sm"
                            >
                              {cell.percent}%
                            </Badge>
                            {cell.mode === 'PAPER' && (
                              <span className="text-[10px] text-muted-foreground">paper</span>
                            )}
                          </span>
                        )}
                      </td>
                    )
                  })}

                  {matrix.requirements.map((requirement) => {
                    const cell = matrix.docCells[cellKey(employee.id, requirement.id)]
                    return (
                      <td key={requirement.id} className="px-2 py-2 text-center">
                        {!cell ? (
                          <span className="text-muted-foreground/50">{t('noData')}</span>
                        ) : (
                          <Badge tone={DOC_TONES[cell.status] ?? 'neutral'} size="sm">
                            {cell.status}
                          </Badge>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrapper>
      )}

      {columnCount === 0 && matrix.employees.length > 0 && (
        <p className={cn('text-sm text-muted-foreground')}>
          {t('noData')} — {t('tests')} / {t('documents')}
        </p>
      )}
    </div>
  )
}
