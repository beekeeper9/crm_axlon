"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Link2, Link2Off, LoaderCircle, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { linkCallAction } from "@/features/calls/actions"
import { searchClientsAction } from "@/features/clients/actions"
import type { ClientOption } from "@/features/clients/api/clients-repository"

type CallLinkFormProps = {
  callId: string
  /** Звонок уже привязан к сделке или клиенту */
  isLinked: boolean
}

/**
 * Привязать звонок к клиенту (поиск по имени или телефону) или отвязать его.
 * К сделке звонок привязывается из её карточки — там его и записывают.
 */
export function CallLinkForm({ callId, isLinked }: CallLinkFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [found, setFound] = useState<ClientOption[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function link(customerId: string | null) {
    startTransition(async () => {
      const error = await linkCallAction(callId, customerId ? { type: "customer", id: customerId } : null)
      setFailure(error)
      if (!error) {
        setOpen(false)
        setFound(null)
        router.refresh()
      }
    })
  }

  return (
    <section className="space-y-2" aria-label="Привязка звонка">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(!isOpen)} disabled={isPending}>
          <Link2 data-icon="inline-start" aria-hidden />
          {isLinked ? "Привязать к другому клиенту" : "Привязать к клиенту"}
        </Button>
        {isLinked && (
          <Button size="sm" variant="ghost" onClick={() => link(null)} disabled={isPending}>
            {isPending && !isOpen ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : (
              <Link2Off data-icon="inline-start" aria-hidden />
            )}
            Отвязать
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="grid gap-2 rounded-lg p-3 ring-1 ring-border">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const result = await searchClientsAction(query)
                if (result.ok) {
                  setFound(result.data)
                  setFailure(null)
                } else setFailure(result.message)
              })
            }}
          >
            <Input aria-label="Поиск клиента" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя или телефон" className="h-8" />
            <Button type="submit" size="sm" variant="outline" disabled={isPending || query.trim().length < 2}>
              <Search data-icon="inline-start" aria-hidden />
              Найти
            </Button>
          </form>
          {found && (
            <ul className="max-h-48 divide-y overflow-y-auto rounded-lg ring-1 ring-border" aria-label="Найденные клиенты">
              {found.length === 0 && <li className="px-3 py-2 text-meta text-muted-foreground">Ничего не нашлось</li>}
              {found.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => link(option.id)}
                    className="w-full px-3 py-2 text-left hover:bg-accent/50 focus-visible:bg-accent/50"
                  >
                    <span className="block text-sm font-medium">{option.name}</span>
                    <span className="block text-meta text-muted-foreground">{option.phone ?? option.email ?? "Без контактов"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </section>
  )
}
