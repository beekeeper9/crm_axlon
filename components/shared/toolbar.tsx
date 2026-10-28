import { cn } from "@/lib/utils"

type ToolbarProps = {
  children: React.ReactNode
  /** Справа: переключатель вида, главное действие */
  end?: React.ReactNode
  className?: string
}

/** Одна строка над данными: поиск и фильтры слева, вид и действие справа; на узком экране переносится */
export function Toolbar({ children, end, className }: ToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {end && <div className="flex shrink-0 items-center gap-2">{end}</div>}
    </div>
  )
}
