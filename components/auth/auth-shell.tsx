import { siteConfig } from "@/config/site"

type AuthShellProps = {
  title: string
  description?: string
  children: React.ReactNode
}

/** Рамка страниц входа: по центру, без навигации приложения */
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {siteConfig.name.slice(0, 1)}
          </span>
          <span className="font-semibold">{siteConfig.name}</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </main>
  )
}
