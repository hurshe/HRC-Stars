import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_COOKIE, resolveLocale, timeZone } from './config'

export default getRequestConfig(async () => {
  // В Next 16 cookies() только асинхронный
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
