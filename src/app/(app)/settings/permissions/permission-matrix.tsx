'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Lock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormError } from '@/components/ui/field'
import { TH, TD, TR, TBody, THead, Table, TableWrapper } from '@/components/ui/table'
import { matrixKey, type MatrixGroup, type MatrixPermission, type MatrixRole } from '@/lib/permission-matrix'
import { togglePermissionAction } from './actions'

export function PermissionMatrix({
  roles,
  groups,
  enabledKeys,
  locale,
}: {
  roles: MatrixRole[]
  groups: MatrixGroup[]
  enabledKeys: string[]
  locale: string
}) {
  const t = useTranslations('settings.permissions')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Галочка должна отзываться мгновенно, а не ждать ответа сервера.
  // Если сервер откажет, useOptimistic сам вернёт прежнее состояние.
  const [enabled, toggleOptimistic] = useOptimistic(
    new Set(enabledKeys),
    (current: Set<string>, change: { key: string; value: boolean }) => {
      const next = new Set(current)
      if (change.value) next.add(change.key)
      else next.delete(change.key)
      return next
    },
  )

  const label = (item: { nameEn: string; namePl: string }) =>
    locale === 'pl' ? item.namePl : item.nameEn

  function onToggle(role: MatrixRole, permission: MatrixPermission, value: boolean) {
    const key = matrixKey(role.id, permission.id)
    setError(null)
    startTransition(async () => {
      toggleOptimistic({ key, value })
      const result = await togglePermissionAction(role.id, permission.id, value)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="space-y-4" aria-busy={pending || undefined}>
      <p className="flex items-start gap-2 rounded-(--radius-control) border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('sensitiveWarning')}
      </p>

      {error && <FormError>{t(`errors.${error}`)}</FormError>}

      {groups.map((group) => (
        <section key={group.group} className="space-y-2">
          <h2 className="font-display text-lg font-bold text-foreground">
            {t(`groups.${group.group}`)}
          </h2>

          <TableWrapper>
            <Table className="min-w-[52rem]">
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-[22rem]">&nbsp;</TH>
                  {roles.map((role) => (
                    <TH
                      key={role.id}
                      className={cn('text-center', !role.editable && 'text-muted-foreground/50')}
                      title={role.editable ? undefined : t('readOnlyRole')}
                    >
                      {role.code}
                    </TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {group.permissions.map((permission) => (
                  <TR key={permission.id}>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        {permission.isSensitive && (
                          <Lock className="size-3.5 shrink-0 text-warning" aria-label={t('sensitive')} />
                        )}
                        <span className="text-sm">{label(permission)}</span>
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {permission.code}
                        {!permission.isEditable && ` · ${t('locked')}`}
                      </div>
                    </TD>

                    {roles.map((role) => {
                      const key = matrixKey(role.id, permission.id)
                      const checked = enabled.has(key)
                      const disabled = !role.editable || !permission.isEditable

                      return (
                        <TD key={role.id} className="text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) => onToggle(role, permission, event.target.checked)}
                            aria-label={`${label(permission)} — ${role.code}`}
                            title={
                              !permission.isEditable
                                ? t('lockedHint')
                                : !role.editable
                                  ? t('readOnlyRole')
                                  : undefined
                            }
                            className="size-4 accent-[var(--primary)] disabled:opacity-40"
                          />
                        </TD>
                      )
                    })}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        </section>
      ))}
    </div>
  )
}
