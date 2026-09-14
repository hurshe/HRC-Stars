import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Award, Download, Search, ShieldCheck } from 'lucide-react'
import { getPermissions, requirePermission } from '@/server/auth/session'
import { listCertificates } from '@/server/services/programs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { EmptyState, TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { ProgramsTabs } from '../programs-tabs'

export default async function CertificatesPage({ searchParams }: PageProps<'/programs/certificates'>) {
  const actor = await requirePermission('certificate.view')
  const permissions = await getPermissions(actor.id)
  const format = await getFormatter()
  const t = await getTranslations('programs')

  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim() : ''
  const certificates = await listCertificates(actor, query || undefined)

  // Точное совпадение номера — это и есть проверка подлинности:
  // кафе, откуда приехал гость MIT, диктует номер, менеджер его вбивает
  const exact = query
    ? certificates.find((certificate) => certificate.number.toLowerCase() === query.toLowerCase())
    : undefined
  const canOpenProfiles = permissions.has('employee.view')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <ProgramsTabs canSeePrograms={permissions.has('program.view')} canSeeCertificates />

      {/* Обычная GET-форма: поиск работает и без JavaScript */}
      <form method="get" role="search" className="flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          {t('certificates.searchPlaceholder')}
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={query}
          placeholder={t('certificates.searchPlaceholder')}
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          <Search className="size-4" aria-hidden />
          {t('certificates.search')}
        </Button>
      </form>

      {exact && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-(--radius-control) border border-success/40 bg-success/10 px-3 py-2 text-sm text-foreground"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          {t('certificates.verified', {
            number: exact.number,
            date: format.dateTime(exact.issuedAt, { dateStyle: 'long' }),
            name: `${exact.user.firstName} ${exact.user.lastName}`,
            program: exact.program.name,
          })}
        </p>
      )}

      {query && certificates.length === 0 && (
        <p
          role="status"
          className="rounded-(--radius-control) border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
        >
          {t('certificates.notFound', { query })}
        </p>
      )}

      {certificates.length === 0 ? (
        !query && (
          <TableWrapper>
            <EmptyState
              icon={<Award className="size-8" aria-hidden />}
              title={t('certificates.empty.title')}
              description={t('certificates.empty.description')}
            />
          </TableWrapper>
        )
      ) : (
        <TableWrapper>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{t('certificates.table.number')}</TH>
                <TH>{t('certificates.table.person')}</TH>
                <TH>{t('certificates.table.program')}</TH>
                <TH>{t('certificates.table.issuedAt')}</TH>
                <TH>{t('certificates.table.issuedBy')}</TH>
                <TH>
                  <span className="sr-only">{t('certificates.table.file')}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {certificates.map((certificate) => {
                const name = `${certificate.user.firstName} ${certificate.user.lastName}`
                return (
                  <TR key={certificate.id}>
                    <TD className="font-mono text-sm">{certificate.number}</TD>
                    <TD>
                      {canOpenProfiles ? (
                        <Link
                          href={`/employees/${certificate.user.id}`}
                          className="font-medium hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium">{name}</span>
                      )}
                    </TD>
                    <TD className="text-sm text-muted-foreground">{certificate.program.name}</TD>
                    <TD className="text-sm text-muted-foreground">
                      {format.dateTime(certificate.issuedAt, { dateStyle: 'medium' })}
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {certificate.issuedBy
                        ? `${certificate.issuedBy.firstName} ${certificate.issuedBy.lastName}`
                        : '—'}
                    </TD>
                    <TD>
                      <a
                        href={`/api/certificates/${certificate.id}/download`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                      >
                        <Download className="size-4" aria-hidden />
                        PDF
                      </a>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  )
}
