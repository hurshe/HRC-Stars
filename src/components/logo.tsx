import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/*
  Логотип Hard Rock Cafe — товарный знак, поэтому в репозитории его нет
  и воспроизводить его рисованием нельзя.

  Положите официальный файл в public/brand/logo.svg (или logo.png) — компонент
  подхватит его автоматически. Пока файла нет, показывается текстовая заглушка.
*/

const CANDIDATES = ['logo.svg', 'logo.png', 'logo.webp']

function findLogo(): string | null {
  for (const name of CANDIDATES) {
    if (existsSync(join(process.cwd(), 'public', 'brand', name))) {
      return `/brand/${name}`
    }
  }
  return null
}

export function Logo({
  className,
  width = 120,
  height = 40,
}: {
  className?: string
  width?: number
  height?: number
}) {
  const src = findLogo()

  if (src) {
    return (
      <Image
        src={src}
        alt="Hard Rock Cafe"
        width={width}
        height={height}
        className={cn('h-auto w-auto object-contain', className)}
        priority
      />
    )
  }

  return (
    <span
      className={cn(
        'font-display text-lg leading-none font-bold tracking-tight text-foreground',
        className,
      )}
    >
      HRC <span className="text-primary">STARS</span>
    </span>
  )
}
