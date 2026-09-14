import { readFile } from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib'

/*
  Сертификат об окончании программы — PDF, который собирается на сервере.

  Шрифты встраиваются из assets/fonts. Стандартные 14 шрифтов PDF закодированы
  в WinAnsi и не содержат польских ą ę ł ś ż: имя «Łukasz Głuchowski» из текущей
  таблицы просто не отрисовалось бы.

  Файл неизменяем: после выдачи он лежит в хранилище как есть. Если позже
  переименуют программу, на уже выданном сертификате останется прежнее
  название — ровно так же, как на бумажном.
*/

export type CertificatePdfInput = {
  /// Язык сертификата — язык интерфейса получателя: гостю MIT нужен английский
  locale: string
  recipientName: string
  programName: string
  locationName: string
  number: string
  issuedAt: Date
  issuerName: string
  issuerRole: string
  timeZone?: string
}

const TEXT = {
  pl: {
    title: 'CERTYFIKAT',
    subtitle: 'ukończenia programu szkoleniowego',
    presentedTo: 'Niniejszym zaświadcza się, że',
    completed: 'ukończył(a) program',
    issued: 'Data wydania',
    number: 'Numer certyfikatu',
    issuedBy: 'Wystawił(a)',
    verify: 'Autentyczność certyfikatu można sprawdzić po numerze w rejestrze HRC STARS.',
  },
  en: {
    title: 'CERTIFICATE',
    subtitle: 'of training program completion',
    presentedTo: 'This is to certify that',
    completed: 'has successfully completed the program',
    issued: 'Date of issue',
    number: 'Certificate number',
    issuedBy: 'Issued by',
    verify: 'The authenticity of this certificate can be verified by its number in the HRC STARS registry.',
  },
} as const

// Цвета светлой темы из globals.css: сертификат печатают на белой бумаге,
// а красный светлой темы темнее и проходит по контрасту на белом
const INK = hex('#171717')
const MUTED = hex('#5c5c5c')
const RED = hex('#c4161c')
const GOLD = hex('#8a6d12')

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts')

type FontFiles = { body: Uint8Array; bodyBold: Uint8Array; display: Uint8Array }
let fontCache: Promise<FontFiles> | null = null

/// Шрифты читаются с диска один раз на процесс. Неудачное чтение из кэша
/// выбрасывается, иначе одна ошибка диска сломала бы генерацию до перезапуска
function loadFonts(): Promise<FontFiles> {
  fontCache ??= Promise.all([
    readFile(path.join(FONT_DIR, 'Inter-Regular.ttf')),
    readFile(path.join(FONT_DIR, 'Inter-SemiBold.ttf')),
    readFile(path.join(FONT_DIR, 'Oswald-Bold.ttf')),
  ])
    .then(([body, bodyBold, display]) => ({ body, bodyBold, display }))
    .catch((error) => {
      fontCache = null
      throw error
    })
  return fontCache
}

export async function renderCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const fonts = await loadFonts()
  const locale = input.locale === 'en' ? 'en' : 'pl'
  const text = TEXT[locale]
  const intlLocale = locale === 'pl' ? 'pl-PL' : 'en-GB'

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  // Inter встраивается целиком: подмножество, которое собирает fontkit,
  // у Inter теряет глифы — на пробном сертификате пропадала половина букв.
  // Файл из-за этого весит около 360 КБ вместо 12 — для сертификата приемлемо.
  // Oswald устроен проще и в подмножестве отрисовывается правильно
  const body = await pdf.embedFont(fonts.body)
  const bodyBold = await pdf.embedFont(fonts.bodyBold)
  const display = await pdf.embedFont(fonts.display, { subset: true })

  pdf.setTitle(`${text.title} ${input.number}`)
  pdf.setSubject(input.programName)
  pdf.setAuthor(input.locationName)
  pdf.setCreator('HRC STARS')
  pdf.setProducer('HRC STARS')
  pdf.setLanguage(intlLocale)
  pdf.setCreationDate(input.issuedAt)
  pdf.setModificationDate(input.issuedAt)

  // A4 альбомная
  const page = pdf.addPage([841.89, 595.28])
  const W = page.getWidth()
  const H = page.getHeight()
  const contentWidth = W - 200

  // Рамка: красная снаружи, тонкая золотая внутри
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: RED, borderWidth: 3 })
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: GOLD, borderWidth: 0.75 })

  centered(page, input.locationName.toLocaleUpperCase(intlLocale), {
    y: H - 92,
    size: 14,
    font: display,
    color: RED,
  })
  page.drawLine({
    start: { x: W / 2 - 30, y: H - 104 },
    end: { x: W / 2 + 30, y: H - 104 },
    thickness: 2,
    color: RED,
  })

  centered(page, text.title, { y: H - 172, size: 52, font: display, color: INK })
  centered(page, text.subtitle, { y: H - 202, size: 14, font: body, color: MUTED })

  centered(page, text.presentedTo, { y: H - 262, size: 13, font: body, color: MUTED })

  const nameSize = fitSize(display, input.recipientName, 38, contentWidth, 20)
  const nameWidth = centered(page, input.recipientName, {
    y: H - 312,
    size: nameSize,
    font: display,
    color: INK,
  })
  const ruleHalf = Math.max(nameWidth, 200) / 2 + 20
  page.drawLine({
    start: { x: W / 2 - ruleHalf, y: H - 326 },
    end: { x: W / 2 + ruleHalf, y: H - 326 },
    thickness: 1,
    color: GOLD,
  })

  centered(page, text.completed, { y: H - 362, size: 13, font: body, color: MUTED })
  centered(page, input.programName, {
    y: H - 396,
    size: fitSize(bodyBold, input.programName, 20, contentWidth, 12),
    font: bodyBold,
    color: INK,
  })

  // Нижний блок: дата, номер, подпись
  const dateText = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: 'long',
    timeZone: input.timeZone ?? 'Europe/Warsaw',
  }).format(input.issuedAt)

  const leftX = 190
  const rightX = W - 190

  labelAndValue(page, text.issued, dateText, { centerX: leftX, body, bodyBold, locale: intlLocale })
  labelAndValue(page, text.number, input.number, { centerX: W / 2, body, bodyBold, locale: intlLocale })

  centered(page, text.issuedBy.toLocaleUpperCase(intlLocale), {
    y: 150,
    size: 8,
    font: body,
    color: MUTED,
    centerX: rightX,
  })
  page.drawLine({
    start: { x: rightX - 95, y: 126 },
    end: { x: rightX + 95, y: 126 },
    thickness: 0.75,
    color: INK,
  })
  centered(page, input.issuerName, {
    y: 110,
    size: fitSize(bodyBold, input.issuerName, 12, 190, 8),
    font: bodyBold,
    color: INK,
    centerX: rightX,
  })
  centered(page, input.issuerRole, { y: 96, size: 9, font: body, color: MUTED, centerX: rightX })

  centered(page, text.verify, { y: 52, size: 8, font: body, color: MUTED })

  return pdf.save()
}

function labelAndValue(
  page: PDFPage,
  label: string,
  value: string,
  options: { centerX: number; body: PDFFont; bodyBold: PDFFont; locale: string },
) {
  centered(page, label.toLocaleUpperCase(options.locale), {
    y: 126,
    size: 8,
    font: options.body,
    color: MUTED,
    centerX: options.centerX,
  })
  centered(page, value, {
    y: 108,
    size: 12,
    font: options.bodyBold,
    color: INK,
    centerX: options.centerX,
  })
}

/// Длинное имя или название программы уменьшается, пока не влезет в строку
function fitSize(font: PDFFont, value: string, preferred: number, maxWidth: number, min: number) {
  let size = preferred
  while (size > min && font.widthOfTextAtSize(value, size) > maxWidth) size -= 1
  return size
}

function centered(
  page: PDFPage,
  value: string,
  options: { y: number; size: number; font: PDFFont; color: Color; centerX?: number },
): number {
  const width = options.font.widthOfTextAtSize(value, options.size)
  const centerX = options.centerX ?? page.getWidth() / 2
  page.drawText(value, {
    x: centerX - width / 2,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color,
  })
  return width
}

function hex(value: string): Color {
  const n = Number.parseInt(value.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
