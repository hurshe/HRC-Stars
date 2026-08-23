export const locales = ['pl', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'pl'

/// Локаль хранится в куке, а не в URL: система внутренняя, язык — настройка
/// сотрудника, а не свойство страницы. Так не нужно дублировать все маршруты
/// под сегментом [locale].
export const LOCALE_COOKIE = 'hrc_locale'

/// Год: язык меняют редко, каждый раз выбирать заново неудобно
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const timeZone = 'Europe/Warsaw'

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value)
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale
}
