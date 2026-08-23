/*
  Проверка предохранителей редактора прав.

  Это самая опасная часть системы: через неё можно поднять себе полномочия
  или запереть систему без администратора. Поэтому запреты проверяются
  отдельно, а не «на глаз» через интерфейс — в интерфейсе такие галочки
  просто заблокированы, а обойти интерфейс несложно.

  Запуск: npx tsx scripts/check-permission-guards.ts
*/
import 'dotenv/config'
import { db } from '../src/lib/db'
import { setRolePermission } from '../src/server/services/permissions-admin'
import type { CurrentUser } from '../src/server/auth/session'

type Case = { name: string; expected: string }

async function main() {
  const roles = await db.role.findMany({ select: { id: true, code: true, level: true } })
  const byCode = new Map(roles.map((r) => [r.code, r]))

  const manager = byCode.get('MANAGER')!
  const gm = byCode.get('GM')!
  const staff = byCode.get('STAFF')!

  const managerUser = await db.user.findFirst({ where: { role: { code: 'MANAGER' } } })

  // Актёр — менеджер. Реального пользователя может не быть, для проверки
  // запретов достаточно его уровня: до записи в базу дело не доходит
  const actor = {
    id: managerUser?.id ?? 'test-actor',
    locationId: (await db.location.findFirstOrThrow()).id,
    role: { code: 'MANAGER', level: manager.level, nameEn: 'Manager', namePl: 'Menedżer' },
  } as CurrentUser

  const lockedPermission = await db.permission.findFirstOrThrow({ where: { isEditable: false } })
  const managePermission = await db.permission.findFirstOrThrow({
    where: { code: 'settings.permissions.manage' },
  })
  const harmless = await db.permission.findFirstOrThrow({ where: { code: 'report.view' } })

  const checks: { case: Case; run: () => Promise<{ ok: boolean; error?: string }> }[] = [
    {
      case: { name: 'Менеджер меняет права роли GM (выше уровнем)', expected: 'roleTooHigh' },
      run: () => setRolePermission(actor, gm.id, harmless.id, true),
    },
    {
      case: { name: 'Менеджер меняет права своей же роли', expected: 'roleTooHigh' },
      run: () => setRolePermission(actor, manager.id, harmless.id, false),
    },
    {
      case: {
        name: `Попытка тронуть право уровня администратора (${lockedPermission.code})`,
        expected: 'permissionLocked',
      },
      run: () => setRolePermission(actor, staff.id, lockedPermission.id, true),
    },
    {
      // Самоблокировка невозможна не потому, что есть отдельная проверка,
      // а потому, что своя роль вообще не редактируется
      case: {
        name: 'GM снимает у своей роли право управления правами',
        expected: 'roleTooHigh',
      },
      run: () =>
        setRolePermission(
          { ...actor, role: { ...actor.role, code: 'GM', level: gm.level } } as CurrentUser,
          gm.id,
          managePermission.id,
          false,
        ),
    },
  ]

  let failures = 0
  console.log('ПРЕДОХРАНИТЕЛИ РЕДАКТОРА ПРАВ')
  console.log('─'.repeat(78))

  for (const check of checks) {
    const result = await check.run()
    const actual = result.ok ? 'РАЗРЕШЕНО' : (result.error ?? 'unknown')
    const passed = !result.ok && actual === check.case.expected
    if (!passed) failures++
    console.log(
      `  ${passed ? 'OK   ' : 'ПЛОХО'} ${check.case.name.padEnd(56)} → ${actual}`,
    )
  }

  console.log('─'.repeat(78))
  if (failures > 0) {
    console.error(`Не сработало предохранителей: ${failures}`)
    process.exitCode = 1
  } else {
    console.log('Все запреты сработали.')
  }

  await db.$disconnect()
}

main()
