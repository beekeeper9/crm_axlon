"use client"

import { Input } from "@/components/ui/input"
import { useSearchParamPatch } from "@/hooks/use-search-param-patch"

/** Период звонков по дням компании (?from=&to=, обе границы включительно) */
export function CallDateFilter() {
  const { patchParams, searchParams } = useSearchParamPatch()
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  return (
    <fieldset className="flex items-center gap-1.5">
      <legend className="sr-only">Период</legend>
      <Input
        type="date"
        aria-label="С даты"
        value={from}
        max={to || undefined}
        onChange={(e) => patchParams({ from: e.target.value || null, page: null })}
        className="h-8 w-36"
      />
      <span className="text-meta text-muted-foreground">—</span>
      <Input
        type="date"
        aria-label="По дату"
        value={to}
        min={from || undefined}
        onChange={(e) => patchParams({ to: e.target.value || null, page: null })}
        className="h-8 w-36"
      />
    </fieldset>
  )
}
