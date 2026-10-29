import { siteConfig } from "@/config/site"

type AuthShellProps = {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/** Рамка страниц входа: одно действие по центру, без навигации приложения */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
            {siteConfig.name.slice(0, 1)}
          </span>
          <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
        </div>
        <div className="space-y-6 rounded-2xl bg-card p-6 ring-1 ring-border sm:p-7">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-meta text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
        {footer}
      </div>
    </main>
  )
}
