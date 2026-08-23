import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_COOKIE, resolveLocale, timeZone } from './config'

export default getRequestConfig(async ({ locale: requested }) => {
  // Явно переданная локаль важнее куки. Без этого письмо-приглашение уходило бы
  // на языке менеджера, который его отправил, а не на языке получателя:
  // getTranslations({ locale }) передаёт язык именно сюда.
  if (requested) {
    const locale = resolveLocale(requested)
    return {
      locale,
      timeZone,
      messages: (await import(`../../messages/${locale}.json`)).default,
    }
  }

  // В Next 16 cookies() только асинхронный
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
