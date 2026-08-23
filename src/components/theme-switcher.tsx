'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const NOOP_SUBSCRIBE = () => () => {}

/// Выбранная тема лежит в localStorage, серверу она неизвестна. Пока страница
/// не гидрирована, ни одна кнопка не считается активной — иначе разметка
/// сервера и клиента разойдутся. useSyncExternalStore даёт это без setState
/// внутри эффекта, на который справедливо ругается линтер React.
function useHydrated(): boolean {
  return useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => true,
    () => false,
  )
}

const OPTIONS = [
  { value: 'light', Icon: Sun, label: 'Light' },
  { value: 'dark', Icon: Moon, label: 'Dark' },
  { value: 'system', Icon: Monitor, label: 'System' },
] as const

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const hydrated = useHydrated()

  return (
    <div
      className={cn('inline-flex rounded-(--radius-control) border border-border p-0.5', className)}
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-pressed={hydrated ? theme === value : undefined}
          title={label}
          className={cn(
            'rounded-[calc(var(--radius-control)-2px)] p-2 transition-colors',
            hydrated && theme === value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
