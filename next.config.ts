import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Пакеты с нативной частью не должны попадать в бандл
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'nodemailer', 'pdf-lib', '@pdf-lib/fontkit'],
  // Шрифты сертификатов читаются с диска во время запроса. Трассировка сборки
  // не видит файлы, открытые через fs, и без явного указания не положила бы их
  // в автономную сборку для Docker
  outputFileTracingIncludes: {
    '/*': ['./assets/fonts/**/*'],
  },
}

export default withNextIntl(nextConfig)
