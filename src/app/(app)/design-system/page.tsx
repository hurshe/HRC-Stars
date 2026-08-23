import { Award, FileText, GraduationCap, Users } from 'lucide-react'
import { Badge, toneForScore, toneForStatus, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, StatCard } from '@/components/ui/card'
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field'
import { Logo } from '@/components/logo'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { requireUser } from '@/server/auth/session'

/*
  Живая дизайн-система HRC STARS.

  Не документ, а работающая страница: всё, что здесь видно, — это те же самые
  компоненты, что стоят на боевых экранах. Документ разошёлся бы с кодом
  через две недели, эта страница разойтись не может.

  Подписи намеренно не переводятся: страница техническая, для разработки,
  а не для сотрудников кафе.
*/

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  { title: 'Surfaces', tokens: ['background', 'card', 'surface-elevated', 'muted', 'popover'] },
  { title: 'Text', tokens: ['foreground', 'muted-foreground'] },
  { title: 'Brand', tokens: ['primary', 'primary-hover', 'primary-foreground'] },
  { title: 'Status', tokens: ['success', 'warning', 'danger', 'info', 'gold'] },
  { title: 'Lines', tokens: ['border', 'border-strong', 'ring'] },
]

const TONES: BadgeTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'gold']

const DOMAIN_STATUSES = [
  'ACTIVE', 'INVITED', 'ON_LEAVE', 'SUSPENDED', 'ARCHIVED',
  'PASSED', 'FAILED', 'IN_PROGRESS', 'NOT_STARTED',
  'EXPIRING_SOON', 'EXPIRED', 'PENDING', 'APPROVED', 'OVERDUE',
]

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/// Обе темы показываются рядом: токены — это CSS-переменные, поэтому
/// достаточно обернуть блок в .dark, чтобы внутри действовала тёмная палитра
function ThemePair({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-(--radius-panel) border border-border bg-background p-4">
        <div className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">Light</div>
        {children}
      </div>
      <div className="dark rounded-(--radius-panel) border border-border bg-background p-4">
        <div className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">Dark</div>
        {children}
      </div>
    </div>
  )
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="space-y-1">
      <div
        className="h-12 rounded-(--radius-control) border border-border"
        style={{ background: `var(--${token})` }}
      />
      <div className="truncate font-mono text-[11px] text-muted-foreground">{token}</div>
    </div>
  )
}

export default async function DesignSystemPage() {
  await requireUser()

  const bands = { danger: 60, warning: 80 }
  const scores = [42, 65, 87, 100]

  return (
    <div className="space-y-10 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Design System</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Живой справочник. Всё на этой странице — те же компоненты, что на боевых экранах.
          </p>
        </div>
        <ThemeSwitcher />
      </header>

      <Section title="Logo" note="Официальный файл кладётся в public/brand/logo.svg — пока текстовая заглушка">
        <ThemePair>
          <Logo />
        </ThemePair>
      </Section>

      <Section
        title="Colors"
        note="Контраст всех пар проверяется командой npm run check:contrast — она читает globals.css"
      >
        <div className="space-y-4">
          {COLOR_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-sm font-medium text-foreground">{group.title}</div>
              <ThemePair>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {group.tokens.map((token) => (
                    <Swatch key={token} token={token} />
                  ))}
                </div>
              </ThemePair>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" note="Oswald для заголовков, Inter для текста. Оба с латиницей-ext — польские диакритики на месте">
        <Card className="space-y-3 p-5">
          <h1 className="font-display text-4xl font-bold text-foreground">Zażółć gęślą jaźń</h1>
          <h2 className="font-display text-2xl font-bold text-foreground">Ćwierć litra kompotu</h2>
          <h3 className="font-display text-lg font-semibold text-foreground">Śnieżnobiały wąż</h3>
          <p className="text-base text-foreground">
            Podstawowy tekst interfejsu — Inter 16px. Zażółć gęślą jaźń, ćma, źdźbło, łąka.
          </p>
          <p className="text-sm text-muted-foreground">
            Tekst pomocniczy — 14px, muted-foreground. Hard Rock Cafe Warszawa.
          </p>
          <p className="text-xs text-muted-foreground">Podpis — 12px.</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <ThemePair>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Zapisz</Button>
              <Button variant="secondary">Anuluj</Button>
              <Button variant="outline">Filtry</Button>
              <Button variant="ghost">Więcej</Button>
              <Button variant="danger">Usuń</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled>Disabled</Button>
              <Button loading>Zapisywanie</Button>
            </div>
          </div>
        </ThemePair>
      </Section>

      <Section title="Badges" note="tone задаёт смысл, variant — насыщенность">
        <ThemePair>
          <div className="space-y-2">
            {(['solid', 'soft', 'outline'] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-1.5">
                <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {variant}
                </span>
                {TONES.map((tone) => (
                  <Badge key={tone} tone={tone} variant={variant}>
                    {tone}
                  </Badge>
                ))}
              </div>
            ))}
          </div>
        </ThemePair>
      </Section>

      <Section
        title="Domain statuses"
        note="Один компонент на всё приложение: у сотрудника, документа и теста статусы выглядят одинаково"
      >
        <Card className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {DOMAIN_STATUSES.map((status) => (
              <Badge key={status} tone={toneForStatus(status)}>
                {status}
              </Badge>
            ))}
          </div>
        </Card>
      </Section>

      <Section
        title="Score bands"
        note={`Цвет считается от настраиваемых порогов (сейчас <${bands.danger}% — красный, <${bands.warning}% — жёлтый), а не зашит в код`}
      >
        <Card className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {scores.map((score) => (
              <Badge key={score} tone={toneForScore(score, bands)} variant="solid" size="md">
                {score}%
              </Badge>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Stat cards">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total staff" value="84" icon={<Users className="size-5" />} trend={{ value: '4 od maja', direction: 'up' }} />
          <StatCard label="Tests passed" value="78%" icon={<GraduationCap className="size-5" />} trend={{ value: '6%', direction: 'up' }} />
          <StatCard label="Documents expiring" value="12" icon={<FileText className="size-5" />} trend={{ value: '2', direction: 'down' }} />
          <StatCard label="Wild Cards" value="48" icon={<Award className="size-5" />} trend={{ value: 'bez zmian', direction: 'flat' }} />
        </div>
      </Section>

      <Section title="Form controls">
        <ThemePair>
          <div className="max-w-sm space-y-4">
            <Field label="Imię i nazwisko" htmlFor="ds-name" required>
              <Input id="ds-name" placeholder="Anna Kowalska" />
            </Field>
            <Field label="Stanowisko" htmlFor="ds-position">
              <Select id="ds-position" defaultValue="SERVER">
                <option value="SERVER">Kelner</option>
                <option value="BARTENDER">Barman</option>
                <option value="COOK">Kucharz</option>
              </Select>
            </Field>
            <Field label="Notatka" htmlFor="ds-note" hint="Widoczna tylko dla menedżerów">
              <Textarea id="ds-note" placeholder="…" />
            </Field>
            <Field label="E-mail" htmlFor="ds-email" error="Nieprawidłowy adres e-mail">
              <Input id="ds-email" defaultValue="anna@" aria-invalid />
            </Field>
            <FormError>Nieprawidłowy e-mail lub hasło</FormError>
          </div>
        </ThemePair>
      </Section>

      <Section title="Card">
        <ThemePair>
          <Card>
            <CardHeader>
              <CardTitle>Beverage Knowledge Test</CardTitle>
              <Badge tone="success">PASSED</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Anna Kowalska — 22/25, 87%. Zaliczone 20.05.2026.
              </p>
            </CardContent>
          </Card>
        </ThemePair>
      </Section>
    </div>
  )
}
