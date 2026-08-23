import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/// Объединяет классы и разрешает конфликты Tailwind:
/// cn('p-2', condition && 'p-4') даст 'p-4', а не оба класса сразу.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
