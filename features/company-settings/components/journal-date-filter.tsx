"use client"

import { Input } from "@/components/ui/input"
import { useSearchParamPatch } from "@/hooks/use-search-param-patch"

/** Дата в параметре адреса (ГГГГ-ММ-ДД); пустое поле убирает фильтр */
export function JournalDateFilter({ label, param }: { label: string; param: string }) {
  const { patchParams, searchParams } = useSearchParamPatch()
  return (
    <Input
      type="date"
      aria-label={label}
      title={label}
      defaultValue={searchParams.get(param) ?? ""}
      onChange={(event) => patchParams({ [param]: event.target.value || null })}
      className="h-8 w-40"
    />
  )
}
