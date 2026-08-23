import { getFormatter, getTranslations } from 'next-intl/server'
import { Ticket } from 'lucide-react'
import { db } from '@/lib/db'
import { getPermissions, requireUser } from '@/server/auth/session'
import {
  getBalance,
  grantReport,
  listMyWildCards,
  listPendingRequests,
  listVoucherTypes,
} from '@/server/services/wildcards'
import { Badge } from '@/components/ui/badge'
import { Card, StatCard } from '@/components/ui/card'
import { EmptyState, TBody, TD, TH, THead, TR, Table, TableWrapper } from '@/components/ui/table'
import { GrantPanel, RequestButton, RequestDecision } from './wildcard-panels'

export default async function WildCardsPage() {
  const actor = await requireUser()
  const permissions = await getPermissions(actor.id)
  const t = await getTranslations('wildcards')
  const format = await getFormatter()

  const canGrant = permissions.has('wildcard.grant')
  const canApprove = permissions.has('wildcard.request.approve')
  const canSeeReport = permissions.has('wildcard.report.view')

  const [balance, vouchers, mine, pending, report, employees] = await Promise.all([
    getBalance(actor.id),
    listVoucherTypes(actor),
    listMyWildCards(actor),
    canApprove ? listPendingRequests(actor) : Promise.resolve([]),
    canSeeReport ? grantReport(actor) : Promise.resolve([]),
    canGrant
      ? db.user.findMany({
          where: {
            locationId: actor.locationId,
            deletedAt: null,
            status: { in: ['ACTIVE', 'ON_LEAVE'] },
            id: { not: actor.id },
          },
          orderBy: { lastName: 'asc' },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t('balance.available')}
          value={balance.available}
          icon={<Ticket className="size-5" aria-hidden />}
        />
        <StatCard label={t('balance.reserved')} value={balance.reserved} />
        <StatCard
          label={t('balance.expiring')}
          value={balance.expiringSoon}
          trend={
            balance.expiringAt
              ? {
                  value: t('balance.expiringAt', {
                    date: format.dateTime(balance.expiringAt, { dateStyle: 'medium' }),
                  }),
                  direction: balance.expiringSoon > 0 ? 'down' : 'flat',
                }
              : undefined
          }
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">{t('catalog.title')}</h2>
        {vouchers.length === 0 ? (
          <TableWrapper>
            <EmptyState title={t('catalog.empty')} />
          </TableWrapper>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vouchers.map((voucher) => (
              <Card key={voucher.id} className="flex flex-col gap-2 p-4">
                <div className="font-medium text-foreground">{voucher.name}</div>
                {voucher.description && (
                  <p className="text-sm text-muted-foreground">{voucher.description}</p>
                )}
                <Badge tone="gold" variant="soft" size="md">
                  {t('catalog.cost', { cost: voucher.cost })}
                </Badge>
                <div className="mt-auto pt-2">
                  <RequestButton
                    voucherTypeId={voucher.id}
                    disabled={balance.available < voucher.cost}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {canApprove && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">{t('requests.title')}</h2>
          {pending.length === 0 ? (
            <TableWrapper>
              <EmptyState title={t('requests.empty')} />
            </TableWrapper>
          ) : (
            <TableWrapper>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>{t('grant.employee')}</TH>
                    <TH>{t('catalog.title')}</TH>
                    <TH>{t('report.cards')}</TH>
                    <TH>{t('requests.requestedAt')}</TH>
                    <TH className="w-0" />
                  </TR>
                </THead>
                <TBody>
                  {pending.map((request) => (
                    <TR key={request.id}>
                      <TD className="font-medium">
                        {request.user.firstName} {request.user.lastName}
                      </TD>
                      <TD>{request.voucherType.name}</TD>
                      <TD>{request.cost}</TD>
                      <TD className="text-sm text-muted-foreground">
                        {format.dateTime(request.requestedAt, { dateStyle: 'medium' })}
                      </TD>
                      <TD>
                        <RequestDecision requestId={request.id} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
          )}
        </section>
      )}

      {canGrant && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">{t('grant.title')}</h2>
          <GrantPanel employees={employees} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">{t('history.title')}</h2>
        <TableWrapper>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{t('history.granted')}</TH>
                <TH>{t('history.reason')}</TH>
                <TH>{t('history.by')}</TH>
                <TH>{t('history.expires')}</TH>
              </TR>
            </THead>
            <TBody>
              {mine.grants.map((grant) => (
                <TR key={grant.id}>
                  <TD>
                    <Badge tone="gold" variant="solid" size="sm">
                      +{grant.amount}
                    </Badge>
                    {grant.consumed > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        −{grant.consumed}
                      </span>
                    )}
                  </TD>
                  <TD className="text-sm">{grant.reason}</TD>
                  <TD className="text-sm text-muted-foreground">
                    {grant.grantedBy.firstName} {grant.grantedBy.lastName}
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {format.dateTime(grant.expiresAt, { dateStyle: 'medium' })}
                  </TD>
                </TR>
              ))}
              {mine.requests.map((request) => (
                <TR key={request.id}>
                  <TD>
                    <Badge tone="neutral" size="sm">
                      −{request.cost}
                    </Badge>
                  </TD>
                  <TD className="text-sm">{request.voucherType.name}</TD>
                  <TD>
                    <Badge
                      tone={
                        request.status === 'APPROVED' || request.status === 'USED'
                          ? 'success'
                          : request.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {t(`status.${request.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {format.dateTime(request.requestedAt, { dateStyle: 'medium' })}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      </section>

      {canSeeReport && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{t('report.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('report.period')}</p>
          </div>
          {report.length === 0 ? (
            <TableWrapper>
              <EmptyState title={t('report.empty')} />
            </TableWrapper>
          ) : (
            <TableWrapper>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>{t('report.granter')}</TH>
                    <TH>{t('report.cards')}</TH>
                    <TH>{t('report.times')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.map((row) => (
                    <TR key={row.granter?.id ?? 'unknown'}>
                      <TD className="font-medium">
                        {row.granter
                          ? `${row.granter.firstName} ${row.granter.lastName}`
                          : '—'}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.granter?.role.code}
                        </span>
                      </TD>
                      <TD>{row.cards}</TD>
                      <TD className="text-muted-foreground">{row.times}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
          )}
        </section>
      )}
    </div>
  )
}
