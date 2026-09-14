import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/server/auth/session'
import { getCertificateDownload } from '@/server/services/programs'

/*
  Скачивание сертификата. Как и документы, файл не отдаётся прямой ссылкой
  на хранилище: сервис проверяет доступ (владелец, реестр или программы)
  и выписывает временную ссылку на пять минут.
*/
export async function GET(_request: Request, context: RouteContext<'/api/certificates/[id]/download'>) {
  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await context.params
  const download = await getCertificateDownload(user, id)

  // Чужой сертификат и несуществующий неразличимы: иначе по ответу
  // можно было бы перебирать идентификаторы
  if (!download) return new NextResponse('Not found', { status: 404 })

  return NextResponse.redirect(download.url)
}
