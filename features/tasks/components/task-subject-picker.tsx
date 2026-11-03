"use client"

import { useEffect, useState } from "react"
import { Handshake, LoaderCircle, UserRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchTaskSubjectsAction } from "@/features/tasks/actions"
import type { TaskSubjectOption } from "@/features/tasks/api/tasks-repository"
import { cn } from "@/lib/utils"

/** Пауза перед запросом, чтобы не искать на каждую букву */
const SEARCH_DELAY_MS = 300

type TaskSubjectPickerProps = {
  value: TaskSubjectOption | null
  onChange: (subject: TaskSubjectOption | null) => void
  error?: string
}

/** Выбор сделки или клиента для новой задачи: поиск по видимым пользователю записям на сервере */
export function TaskSubjectPicker({ value, onChange, error }: TaskSubjectPickerProps) {
  const [search, setSearch] = useState("")
  const [options, setOptions] = useState<TaskSubjectOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (value) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      const result = await searchTaskSubjectsAction(search)
      if (cancelled) return
      setIsLoading(false)
      if (result.ok) {
        setOptions(result.options)
        setFailure(null)
      } else setFailure(result.message)
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, value])

  if (value) {
    const Icon = value.type === "deal" ? Handshake : UserRound
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-medium">{value.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{value.type === "deal" ? "сделка" : "клиент"}</span>
        </span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(null)} aria-label="Выбрать другую сделку или клиента">
          <X aria-hidden />
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      <Input
        id="task-subject"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Найти сделку или клиента"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "task-subject-error" : undefined}
        autoComplete="off"
      />
      <div className="max-h-48 overflow-y-auto rounded-lg border" role="listbox" aria-label="Сделки и клиенты">
        {isLoading ? (
          <p className="flex items-center gap-2 px-3 py-2 text-meta text-muted-foreground">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            Ищем…
          </p>
        ) : failure ? (
          <p className="px-3 py-2 text-meta text-destructive">{failure}</p>
        ) : options.length === 0 ? (
          <p className="px-3 py-2 text-meta text-muted-foreground">Ничего не найдено. Уточните название или имя.</p>
        ) : (
          options.map((option) => {
            const Icon = option.type === "deal" ? Handshake : UserRound
            return (
              <button
                key={`${option.type}-${option.id}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onChange(option)}
                className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent")}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{option.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.type === "deal" ? "сделка" : "клиент"}</span>
              </button>
            )
          })
        )}
      </div>
      {error && (
        <p id="task-subject-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
