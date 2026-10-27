import { CircleAlert } from "lucide-react"
import { cn } from "cn"

type ErrorStateProps = {
  title?: string
  description?: string
  /** Обычно кнопка «Повторить» */
  action?: React.ReactNode
  className?: string
}

export function ErrorState({
  title = "Не удалось загрузить данные",
  description = "Попробуйте ещё раз. Если ошибка повторяется, сообщите администратору.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-8 text-center",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <CircleAlert className="size-5" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
