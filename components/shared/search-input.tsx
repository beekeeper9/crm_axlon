"use client"

import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Search, X } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"
import { useSearchParamPatch } from "@/hooks/use-search-param-patch"

const DEBOUNCE_MS = 300

type SearchInputProps = {
  label: string
  placeholder?: string
  /** Имя параметра адреса */
  param?: string
  className?: string
}

/** Поиск, привязанный к адресу (?q=). Запрос уходит после паузы в наборе. */
export function SearchInput({ label, placeholder, param = "q", className }: SearchInputProps) {
  const { patchParams, isPending, searchParams } = useSearchParamPatch()
  const urlValue = searchParams.get(param) ?? ""
  const [value, setValue] = useState(urlValue)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function update(next: string) {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => patchParams({ [param]: next.trim() || null }), DEBOUNCE_MS)
  }

  function clear() {
    clearTimeout(timer.current)
    setValue("")
    patchParams({ [param]: null })
  }

  return (
    <div className={cn("relative", className)}>
      {isPending ? (
        <LoaderCircle className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      )}
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => update(event.target.value)}
        className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Очистить поиск"
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
