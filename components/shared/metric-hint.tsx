"use client"

import { CircleHelp } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type MetricHintProps = {
  label: string
  definition: string
  /** Определение ещё не утверждено — показываем пометку «вопрос» */
  isOpenQuestion?: boolean
}

/** Иконка «?» рядом с числом: как оно считается (книга определений метрик) */
export function MetricHint({ label, definition, isOpenQuestion = false }: MetricHintProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Как считается: ${label}`}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 align-middle hover:text-foreground focus-visible:text-foreground"
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-1.5 text-meta" align="start">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">{definition}</p>
        {isOpenQuestion && <p className="text-xs text-warning">Определение ещё согласуется</p>}
      </PopoverContent>
    </Popover>
  )
}
