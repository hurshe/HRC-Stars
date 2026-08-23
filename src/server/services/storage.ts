import { randomUUID } from 'node:crypto'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/*
  Файловое хранилище.

  Локально это MinIO, в продакшене — S3 или Cloudflare R2. Разница только
  в переменных окружения: код одинаковый, потому что все три говорят
  на одном протоколе. Это и было причиной выбрать S3-совместимое хранилище,
  а не складывать файлы на диск сервера.

  Файлы не отдаются напрямую: на каждый показ выписывается временная ссылка.
  Иначе утёкший однажды URL работал бы вечно, а среди файлов есть медкнижки
  и договоры.
*/

const BUCKET = process.env.S3_BUCKET ?? 'hrc-stars'
const URL_TTL_SECONDS = 300

let client: S3Client | null = null

function getClient(): S3Client {
  if (client) return client

  client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    // MinIO работает по пути, а не по поддомену бакета
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  })

  return client
}

/// Бакет создаётся при первом обращении: одной ручной операцией меньше
/// при развёртывании на новой машине
export async function ensureBucket(): Promise<void> {
  const s3 = getClient()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
  }
}

/// Ключ включает случайный идентификатор: два человека могут загрузить
/// «skan.pdf», и один файл не должен затирать другой
export function buildKey(prefix: string, fileName: string): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .slice(-80)
  return `${prefix}/${randomUUID()}-${safeName}`
}

export async function uploadFile(params: {
  key: string
  body: Buffer | Uint8Array
  contentType?: string
}): Promise<void> {
  await ensureBucket()
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  )
}

/// Временная ссылка на скачивание. Живёт пять минут — этого хватает,
/// чтобы открыть файл, и мало, чтобы ссылка куда-то ушла надолго
export async function getDownloadUrl(key: string, fileName?: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: fileName
        ? `inline; filename="${encodeURIComponent(fileName)}"`
        : undefined,
    }),
    { expiresIn: URL_TTL_SECONDS },
  )
}

export async function deleteFile(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/// Разрешённые типы. Список закрытый, а не «всё кроме опасного»:
/// перечислять допустимое безопаснее, чем угадывать вредное
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'video/mp4',
  'text/plain',
])

export type UploadCheck = { ok: true } | { ok: false; error: 'tooLarge' | 'unsupportedType' }

export function checkUpload(file: { size: number; type: string }): UploadCheck {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'tooLarge' }
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { ok: false, error: 'unsupportedType' }
  return { ok: true }
}
