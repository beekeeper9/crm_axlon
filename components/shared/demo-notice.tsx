import { FlaskConical } from "lucide-react"
import { cn } from "cn"

type DemoNoticeProps = {
  children: React.ReactNode
  className?: string
}

/** Пояснение, что действие работает только в демо-режиме и ничего не сохраняет */
export function DemoNotice({ children, className }: DemoNoticeProps) {
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border border-dashed border-warning/40 bg-warning/6 px-3 py-2 text-xs text-muted-foreground", className)}>
      <FlaskConical className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
