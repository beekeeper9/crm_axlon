import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  /** Дополнительные классы заголовка (например, фирменный шрифт) */
  titleClassName?: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, titleClassName, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className={cn("text-xl font-semibold tracking-tight", titleClassName)}>{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
