import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, getPermissions } from '@/server/auth/session'
import { permissionForSpace } from '@/server/services/documents'
import { writeAudit } from '@/server/services/audit'
import { getDownloadUrl } from '@/server/services/storage'

/*
  Скачивание версии документа.

  Файлы не отдаются по прямой ссылке на хранилище: сначала проверяем,
  что человек имеет право на этот раздел, и только потом выписываем
  временную ссылку на пять минут. Иначе один раз утёкший URL медкнижки
  работал бы вечно.
*/
export async function GET(_request: Request, context: RouteContext<'/api/documents/[versionId]/download'>) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { versionId } = await context.params

  const version = await db.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      fileKey: true,
      fileName: true,
      document: { select: { id: true, space: true, locationId: true, deletedAt: true } },
    },
  })

  if (!version?.fileKey || version.document.deletedAt) {
    return new NextResponse('Not found', { status: 404 })
  }
  if (version.document.locationId !== user.locationId) {
    return new NextResponse('Not found', { status: 404 })
  }

  const permissions = await getPermissions(user.id)
  if (!permissions.has(permissionForSpace(version.document.space))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // Скачивание HR-документа — это доступ к персональным данным,
  // поэтому пишется в аудит как чувствительное действие
  await writeAudit({
    actorId: user.id,
    action: 'document.downloaded',
    entityType: 'DocumentVersion',
    entityId: versionId,
    locationId: user.locationId,
    isSensitive: version.document.space === 'HR',
    after: { documentId: version.document.id },
  })

  return NextResponse.redirect(await getDownloadUrl(version.fileKey, version.fileName ?? undefined))
}
