import nodemailer, { type Transporter } from 'nodemailer'
import { getTranslations, getFormatter } from 'next-intl/server'
import type { Locale } from '@/i18n/config'

// Провайдер спрятан за этим модулем: переезд с локального Mailpit на SMTP
// провайдера или на Resend не затрагивает вызывающий код.
let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
      : undefined,
  })

  return transporter
}

type SendResult = { ok: true } | { ok: false; error: string }

async function send(options: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM ?? 'HRC STARS <noreply@hrcstars.local>',
      ...options,
    })
    return { ok: true }
  } catch (error) {
    console.error('[mailer] не удалось отправить письмо на', options.to, error)
    return { ok: false, error: error instanceof Error ? error.message : 'unknown' }
  }
}

/// Нейтральное оформление: письмо получит фирменный вид, когда согласуем визуал.
function layout(body: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    ${body}
  </div>
</body></html>`
}

export async function sendInvitationEmail(params: {
  to: string
  name: string
  url: string
  expiresAt: Date
  locale: Locale
}): Promise<SendResult> {
  const t = await getTranslations({ locale: params.locale, namespace: 'email.invitation' })
  const format = await getFormatter({ locale: params.locale })
  const expires = format.dateTime(params.expiresAt, {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const html = layout(`
    <h1 style="margin:0 0 16px;font-size:20px">${t('greeting', { name: params.name })}</h1>
    <p style="margin:0 0 12px;line-height:1.6">${t('body')}</p>
    <p style="margin:0 0 24px;line-height:1.6">${t('instruction')}</p>
    <p style="margin:0 0 24px">
      <a href="${params.url}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${t('cta')}</a>
    </p>
    <p style="margin:0 0 16px;color:#666;font-size:14px">${t('expires', { date: expires })}</p>
    <p style="margin:0 0 4px;color:#666;font-size:13px">${t('fallback')}</p>
    <p style="margin:0 0 24px;color:#666;font-size:13px;word-break:break-all">${params.url}</p>
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
    <p style="margin:0;color:#888;font-size:12px;line-height:1.5">${t('ignore')}</p>
  `)

  const text = [
    t('greeting', { name: params.name }),
    '',
    t('body'),
    t('instruction'),
    '',
    params.url,
    '',
    t('expires', { date: expires }),
    '',
    t('ignore'),
  ].join('\n')

  return send({ to: params.to, subject: t('subject'), html, text })
}
