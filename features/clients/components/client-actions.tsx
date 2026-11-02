"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, LoaderCircle, Plus, UserRoundCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { leadRoute } from "@/config/routes"
import { assignClientAction, createClientDealAction, setClientArchivedAction, type ClientActionResult } from "@/features/clients/actions"

type Person = { id: string; name: string }

type ClientActionsProps = {
  clientId: string
  isArchived: boolean
  managerId: string | null
  /** Кому можно передать клиента; пусто — передавать нельзя (менеджер) */
  members: readonly Person[]
}

/** Новая сделка, архив и передача клиента. Права и правила окончательно проверяет backend */
export function ClientActions({ clientId, isArchived, managerId, members }: ClientActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [mode, setMode] = useState<"idle" | "deal" | "assign">("idle")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [owner, setOwner] = useState<string | null>(managerId)

  function act<T>(operation: () => Promise<ClientActionResult<T>>, after?: (data: T) => void) {
    startTransition(async () => {
      const result = await operation()
      if (result.ok) {
        setFailure(null)
        setMode("idle")
        if (after) after(result.data)
        else router.refresh()
      } else setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
    })
  }

  return (
    <section className="space-y-3" aria-label="Действия с клиентом">
      <div className="flex flex-wrap gap-2">
        {!isArchived && (
          <Button size="sm" onClick={() => setMode(mode === "deal" ? "idle" : "deal")} disabled={isPending}>
            <Plus data-icon="inline-start" aria-hidden />
            Новая сделка
          </Button>
        )}
        {!isArchived && members.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setMode(mode === "assign" ? "idle" : "assign")} disabled={isPending}>
            <UserRoundCog data-icon="inline-start" aria-hidden />
            Передать
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => act(() => setClientArchivedAction(clientId, !isArchived))} disabled={isPending}>
          {isPending && mode === "idle" ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : isArchived ? (
            <ArchiveRestore data-icon="inline-start" aria-hidden />
          ) : (
            <Archive data-icon="inline-start" aria-hidden />
          )}
          {isArchived ? "Вернуть из архива" : "В архив"}
        </Button>
      </div>

      {mode === "deal" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            act(() => createClientDealAction(clientId, { title, amount }), (dealId) => router.push(leadRoute(dealId)))
          }}
        >
          <p className="text-meta text-muted-foreground">Повторное обращение — отдельная сделка: она станет продажей после первой оплаты.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-title">Название</Label>
            <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deal-amount">Сумма</Label>
            <Input id="deal-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="15000" className="h-9" />
          </div>
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Создать и открыть
          </Button>
        </form>
      )}

      {mode === "assign" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            if (owner) act(() => assignClientAction(clientId, owner))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="client-owner">Ответственный</Label>
            <Select items={members.map((m) => ({ value: m.id, label: m.name }))} value={owner} onValueChange={setOwner}>
              <SelectTrigger id="client-owner" className="h-9 w-full">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={isPending || !owner || owner === managerId} className="w-fit">
            Передать
          </Button>
        </form>
      )}

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </section>
  )
}
