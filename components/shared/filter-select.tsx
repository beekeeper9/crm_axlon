"use client"

import { cn } from "cn"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSearchParamPatch } from "@/hooks/use-search-param-patch"

export type FilterOption = { value: string; label: string }

/** Значение «без фильтра»; в адресе параметр в этом случае отсутствует */
const ALL = "__all__"

type FilterSelectProps = {
  label: string
  /** Имя параметра адреса */
  param: string
  options: readonly FilterOption[]
  allLabel: string
  className?: string
}

/** Выпадающий фильтр, привязанный к параметру адреса */
export function FilterSelect({ label, param, options, allLabel, className }: FilterSelectProps) {
  const { patchParams, searchParams } = useSearchParamPatch()
  const current = searchParams.get(param)
  const value = options.some((option) => option.value === current) ? current! : ALL
  const items = [{ value: ALL, label: allLabel }, ...options]

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => patchParams({ [param]: next === ALL ? null : next })}
    >
      <SelectTrigger aria-label={label} className={cn("min-w-40", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
