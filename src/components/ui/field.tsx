import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Границы полей используют border-strong, а не border: по WCAG 1.4.11
// граница интерактивного элемента должна давать контраст 3:1, иначе
// поле ввода визуально сливается с фоном
const control =
  'w-full rounded-(--radius-control) border border-border-strong bg-card text-foreground ' +
  'placeholder:text-muted-foreground ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'aria-[invalid=true]:border-danger'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-11 px-3 text-base', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 px-3 py-2 text-base', className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'h-11 px-3 text-base', className)} {...props} />
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p
      role="alert"
      className="rounded-(--radius-control) border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {children}
    </p>
  )
}
