"use client"

import { usePathname } from "next/navigation"
import { FlaskConical } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { findNavItem } from "@/config/navigation"

type AppHeaderProps = {
  /** Показать метку «Демо-данные», пока backend не подключён */
  isDemoData: boolean
}

export function AppHeader({ isDemoData }: AppHeaderProps) {
  const pathname = usePathname()
  const title = findNavItem(pathname)?.title

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <SidebarTrigger className="-ml-1.5" aria-label="Показать или скрыть меню" />
      <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-center" />
      {title && <span className="truncate text-sm font-medium">{title}</span>}

      <div className="ml-auto flex items-center gap-2">
        {isDemoData && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex h-6 cursor-default items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 text-xs font-medium text-warning" />
              }
            >
              <FlaskConical className="size-3.5" aria-hidden />
              Демо-данные
            </TooltipTrigger>
            <TooltipContent>
              Интерфейс работает на демонстрационных данных. Backend ещё не подключён.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  )
}
