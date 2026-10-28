import { cn } from "@/lib/utils"

import { formatInitials } from "@/lib/format"

type PersonAvatarProps = {
  name: string
  size?: "sm" | "md"
  className?: string
}

/** Инициалы сотрудника; полное имя — во всплывающей подсказке и для экранного диктора */
export function PersonAvatar({ name, size = "sm", className }: PersonAvatarProps) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground",
        size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs",
        className
      )}
    >
      <span aria-hidden>{formatInitials(name)}</span>
      <span className="sr-only">{name}</span>
    </span>
  )
}
