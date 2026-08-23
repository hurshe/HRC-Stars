import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

/*
  Шифрование персональных данных на уровне приложения (GDPR).

  Что шифруем: адрес, телефон, дату рождения, номер документа, контакт
  для экстренной связи. То есть всё, что само по себе идентифицирует человека
  или относится к его частной жизни.

  Что НЕ шифруем: имя, фамилию и email. По ним идёт поиск, сортировка и вход
  в систему — зашифрованное поле для этого непригодно. Это осознанный размен:
  защищаем то, что реально чувствительно, и не ломаем работу с базой.

  Алгоритм: AES-256-GCM. Он не только шифрует, но и проверяет целостность —
  подменённое значение не расшифруется, а не вернёт мусор.

  Формат хранения: v1.<iv>.<tag>.<ciphertext>, всё в base64url.
  Префикс версии нужен для смены ключа: старые записи можно будет распознать
  и перешифровать, не гадая по длине строки.
*/

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.PII_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'PII_ENCRYPTION_KEY не задан. Сгенерировать: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    )
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_LENGTH) {
    throw new Error(`PII_ENCRYPTION_KEY должен быть 32 байта в base64, получено ${key.length}`)
  }

  cachedKey = key
  return key
}

export function encryptPII(value: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptPII(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Неизвестный формат зашифрованного значения')
  }

  const [, iv, tag, ciphertext] = parts
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/// Удобные обёртки: в базе поля необязательные, и таскать проверки на null
/// по всему коду не хочется
export function encryptOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? encryptPII(trimmed) : null
}

export function decryptOptional(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    return decryptPII(payload)
  } catch {
    // Значение зашифровано другим ключом или повреждено. Роняем не весь профиль,
    // а только это поле — остальные данные сотрудника остаются доступны
    console.error('[crypto] не удалось расшифровать значение')
    return null
  }
}

/// Проверка, что ключ рабочий. Вызывается при старте, чтобы проблема
/// всплыла сразу, а не в момент сохранения первой карточки сотрудника
export function assertEncryptionWorks(): void {
  const probe = 'hrc-stars-probe'
  const restored = decryptPII(encryptPII(probe))
  const a = Buffer.from(restored)
  const b = Buffer.from(probe)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Проверка шифрования персональных данных не прошла')
  }
}
