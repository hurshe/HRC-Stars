/*
  Проверка контраста дизайн-токенов по WCAG 2.1.

  Читает src/app/globals.css — то есть проверяет ровно те значения,
  которые реально попадут в интерфейс. Захардкоженной копии палитры нет,
  поэтому проверка не может разойтись с действительностью.

  Запуск: npm run check:contrast
*/
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CSS_PATH = join(process.cwd(), 'src', 'app', 'globals.css')

// ─── Разбор цветов ────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  const value = hex.trim().replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

/// Относительная яркость по формуле WCAG 2.1
function luminance(hex: string): number {
  const channels = parseHex(hex).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

// ─── Чтение токенов из CSS ────────────────────────────────────────────────

function extractBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`Блок ${selector} не найден в globals.css`)

  const open = css.indexOf('{', start)
  const end = css.indexOf('\n}', open)
  const body = css.slice(open + 1, end)

  const tokens: Record<string, string> = {}
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
    tokens[match[1]] = match[2]
  }
  return tokens
}

// ─── Что именно проверяем ─────────────────────────────────────────────────

type Check = {
  fg: string
  bg: string
  /// 4.5 — обычный текст, 3 — крупный текст и элементы интерфейса
  min: 4.5 | 3
  usage: string
}

const CHECKS: Check[] = [
  { fg: 'foreground', bg: 'background', min: 4.5, usage: 'основной текст' },
  { fg: 'muted-foreground', bg: 'background', min: 4.5, usage: 'вторичный текст' },
  { fg: 'muted-foreground', bg: 'card', min: 4.5, usage: 'вторичный текст на карточке' },
  { fg: 'muted-foreground', bg: 'surface-elevated', min: 4.5, usage: 'вторичный текст на панели' },
  { fg: 'card-foreground', bg: 'card', min: 4.5, usage: 'текст на карточке' },
  { fg: 'popover-foreground', bg: 'popover', min: 4.5, usage: 'текст во всплывающем окне' },
  { fg: 'secondary-foreground', bg: 'secondary', min: 4.5, usage: 'вторичная кнопка' },

  { fg: 'primary-foreground', bg: 'primary', min: 4.5, usage: 'текст на красной кнопке' },
  { fg: 'primary', bg: 'background', min: 3, usage: 'красный акцент, рамки, крупный текст' },
  { fg: 'primary', bg: 'card', min: 3, usage: 'красный акцент на карточке' },

  { fg: 'success-foreground', bg: 'success', min: 4.5, usage: 'бейдж «пройдено»' },
  { fg: 'warning-foreground', bg: 'warning', min: 4.5, usage: 'бейдж «скоро истекает»' },
  { fg: 'danger-foreground', bg: 'danger', min: 4.5, usage: 'бейдж «просрочено»' },
  { fg: 'info-foreground', bg: 'info', min: 4.5, usage: 'информационный бейдж' },
  { fg: 'gold-foreground', bg: 'gold', min: 4.5, usage: 'бейдж Wild Card' },

  { fg: 'success', bg: 'card', min: 3, usage: 'зелёный индикатор на карточке' },
  { fg: 'warning', bg: 'card', min: 3, usage: 'жёлтый индикатор на карточке' },
  { fg: 'danger', bg: 'card', min: 3, usage: 'красный индикатор на карточке' },
  { fg: 'info', bg: 'card', min: 3, usage: 'синий индикатор на карточке' },
  { fg: 'gold', bg: 'card', min: 3, usage: 'золотой индикатор на карточке' },

  { fg: 'border-strong', bg: 'background', min: 3, usage: 'рамка поля ввода' },
  { fg: 'border-strong', bg: 'card', min: 3, usage: 'рамка поля ввода на карточке' },
  { fg: 'ring', bg: 'background', min: 3, usage: 'кольцо фокуса' },
]

// ─── Запуск ───────────────────────────────────────────────────────────────

const css = readFileSync(CSS_PATH, 'utf8')
const themes = {
  'светлая': extractBlock(css, ':root {'),
  'тёмная': extractBlock(css, '.dark {'),
}

let failures = 0
let warnings = 0

for (const [themeName, tokens] of Object.entries(themes)) {
  console.log(`\n${themeName.toUpperCase()} ТЕМА`)
  console.log('─'.repeat(78))

  for (const check of CHECKS) {
    const fg = tokens[check.fg]
    const bg = tokens[check.bg]

    if (!fg || !bg) {
      console.log(`  ?  ${check.fg} на ${check.bg} — токен не найден`)
      warnings++
      continue
    }

    const ratio = contrast(fg, bg)
    const passed = ratio >= check.min
    if (!passed) failures++

    const mark = passed ? 'OK  ' : 'ПЛОХО'
    const pair = `${check.fg} на ${check.bg}`.padEnd(42)
    console.log(
      `  ${mark} ${pair} ${ratio.toFixed(2).padStart(5)}:1  (нужно ${check.min}) — ${check.usage}`,
    )
  }
}

console.log('\n' + '═'.repeat(78))
if (failures > 0) {
  console.error(`Проверка не пройдена: ${failures} пар не дотягивают до порога WCAG AA.`)
  process.exit(1)
}
console.log(`Все пары проходят WCAG AA${warnings ? ` (пропущено токенов: ${warnings})` : ''}.`)
