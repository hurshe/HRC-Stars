import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

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
    <html lang={locale}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
