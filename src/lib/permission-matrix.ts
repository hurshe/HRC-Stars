/*
  Типы и хелперы матрицы прав, безопасные для клиента.

  Держим их отдельно от сервисного слоя намеренно: клиентскому компоненту
  нужен всего один хелпер, но импорт из серверного модуля тянет за собой
  next/headers и Prisma, и сборка падает. Типы стираются компилятором,
  а функция — нет.
*/

export type MatrixRole = {
  id: string
  code: string
  level: number
  nameEn: string
  namePl: string
  /// Роль своего уровня и выше редактировать нельзя
  editable: boolean
}

export type MatrixPermission = {
  id: string
  code: string
  group: string
  nameEn: string
  namePl: string
  isSensitive: boolean
  isEditable: boolean
}

export type MatrixGroup = { group: string; permissions: MatrixPermission[] }

export const matrixKey = (roleId: string, permissionId: string) => `${roleId}:${permissionId}`
