import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Пакеты с нативной частью не должны попадать в бандл
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'nodemailer'],
}

export default withNextIntl(nextConfig)
