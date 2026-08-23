import type { Metadata, Viewport } from 'next'
import { Inter, Oswald } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

// latin-ext обязателен: без него не отрисуются польские ą ć ę ł ń ó ś ź ż,
// а польский у нас основной язык интерфейса
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
})

const oswald = Oswald({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-oswald',
  display: 'swap',
  weight: ['500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'HRC STARS',
  description: 'Hard Rock Cafe — dokumenty, szkolenia i listy kontrolne',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Масштабирование не блокируем: это требование доступности
  maximumScale: 5,
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    // suppressHydrationWarning нужен next-themes: класс темы проставляется
    // скриптом до гидрации, иначе при загрузке мигал бы светлый фон
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${oswald.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
