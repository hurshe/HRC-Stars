import { LocaleSwitcher } from '@/components/locale-switcher'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="rounded-(--radius-panel) border border-border bg-surface p-6 shadow-sm sm:p-8">
          {children}
        </div>
        <div className="mt-6 flex justify-center">
          <LocaleSwitcher />
        </div>
      </main>
    </div>
  )
}
