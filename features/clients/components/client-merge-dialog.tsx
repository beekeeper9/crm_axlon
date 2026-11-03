"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { mergeClientsAction, previewClientMergeAction, searchClientsAction, type ClientActionResult } from "@/features/clients/actions"
import type { ClientOption, MergePlan } from "@/features/clients/api/clients-repository"
import { formatNumber } from "@/lib/format"

/** Подписи того, что переходит из дубля; неизвестные ключи backend показываем как есть */
const REFERENCE_LABELS: Record<string, string> = {
  deals: "Сделки",
  activities: "Задачи, заметки и звонки в истории",
  meetings: "Встречи",
  calls: "Звонки телефонии",
  payments: "Оплаты",
  invoices: "Счета",
  leads: "Лиды",
  conversations: "Переписки",
}

const FILL_LABELS: Record<string, string> = { email: "e-mail", phone: "телефон" }

type ClientMergeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Основная карточка: она остаётся, дубль присоединяется к ней */
  target: { id: string; name: string }
}

/**
 * Объединение дублей: найти дубль → посмотреть, что перейдёт → подтвердить.
 * Дубль не удаляется: уходит в архив с отметкой «объединён», история сохраняется.
 */
export function ClientMergeDialog({ open, onOpenChange, target }: ClientMergeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <MergeFlow target={target} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function MergeFlow({ target, onDone }: { target: ClientMergeDialogProps["target"]; onDone: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [found, setFound] = useState<ClientOption[] | null>(null)
  const [source, setSource] = useState<ClientOption | null>(null)
  const [plan, setPlan] = useState<MergePlan | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function act<T>(operation: () => Promise<ClientActionResult<T>>, after: (data: T) => void) {
    startTransition(async () => {
      const result = await operation()
      if (result.ok) {
        setFailure(null)
        after(result.data)
      } else setFailure(result.requestId ? `${result.message} Код запроса: ${result.requestId}` : result.message)
    })
  }

  function choose(option: ClientOption) {
    setSource(option)
    setPlan(null)
    act(() => previewClientMergeAction(target.id, option.id), setPlan)
  }

  const moving = plan ? Object.entries(plan.references).filter(([, count]) => count > 0) : []

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Объединить с дублем</DialogTitle>
        <DialogDescription>
          Основная карточка — «{target.name}». Сделки, задачи, встречи, звонки и оплаты дубля перейдут к ней, дубль уйдёт в архив с
          отметкой «объединён».
        </DialogDescription>
      </DialogHeader>

      <form
        className="grid gap-1.5"
        onSubmit={(event) => {
          event.preventDefault()
          act(() => searchClientsAction(query), (options) => setFound(options.filter((option) => option.id !== target.id)))
        }}
      >
        <Label htmlFor="merge-search">Дубль</Label>
        <div className="flex gap-2">
          <Input id="merge-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя или телефон" className="h-9" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending || query.trim().length < 2}>
            <Search data-icon="inline-start" aria-hidden />
            Найти
          </Button>
        </div>
      </form>

      {found && !source && (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg ring-1 ring-border" aria-label="Найденные карточки">
          {found.length === 0 && <li className="px-3 py-2 text-meta text-muted-foreground">Ничего не нашлось</li>}
          {found.map((option) => (
            <li key={option.id}>
              <button type="button" onClick={() => choose(option)} className="w-full px-3 py-2 text-left hover:bg-accent/50 focus-visible:bg-accent/50">
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block text-meta text-muted-foreground">{[option.phone, option.email].filter(Boolean).join(" · ") || "Без контактов"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {source && (
        <section className="grid gap-2 rounded-lg p-3 ring-1 ring-border" aria-label="Что перейдёт">
          <p className="text-sm">
            Дубль: <span className="font-medium">{source.name}</span>{" "}
            <button type="button" className="text-meta text-primary hover:underline" onClick={() => {
                setSource(null)
                setPlan(null)
              }}>
              выбрать другой
            </button>
          </p>
          {plan ? (
            <>
              {moving.length > 0 ? (
                <ul className="grid gap-0.5 text-meta">
                  {moving.map(([key, count]) => (
                    <li key={key} className="flex justify-between gap-3">
                      <span>{REFERENCE_LABELS[key] ?? key}</span>
                      <span className="tabular-nums">{formatNumber(count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-muted-foreground">У дубля нет сделок и истории — перейдут только контакты.</p>
              )}
              {plan.fills.length > 0 && (
                <p className="text-meta text-muted-foreground">
                  Основная карточка получит из дубля: {plan.fills.map((field) => FILL_LABELS[field] ?? field).join(", ")}.
                </p>
              )}
            </>
          ) : (
            isPending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Загрузка" />
          )}
        </section>
      )}

      {failure && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {failure}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Отмена
        </Button>
        <Button
          type="button"
          disabled={isPending || !source || !plan}
          onClick={() =>
            source &&
            act(
              () => mergeClientsAction(target.id, source.id),
              () => {
                onDone()
                router.refresh()
              }
            )
          }
        >
          {isPending && source && plan && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Объединить
        </Button>
      </DialogFooter>
    </div>
  )
}
