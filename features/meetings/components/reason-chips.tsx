"use client"

import { cn } from "@/lib/utils"

/** Причины из справочника компании: клик подставляет текст, своя причина пишется в поле рядом */
export function ReasonChips({ reasons, value, onPick }: { reasons: readonly string[]; value: string; onPick: (reason: string) => void }) {
  if (reasons.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Причины из справочника">
      {reasons.map((reason) => (
        <button
          key={reason}
          type="button"
          aria-pressed={value === reason}
          onClick={() => onPick(reason)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60",
            value === reason && "bg-primary/10 text-primary ring-primary/40"
          )}
        >
          {reason}
        </button>
      ))}
    </div>
  )
}
