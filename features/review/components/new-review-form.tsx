"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { issueReviewPackageAction } from "@/features/review/actions"
import type { DealOption } from "@/features/review/api/review-repository"

type Person = { id: string; name: string }

/** Форма РОПа: сотрудник → его открытые сделки → что сделать и срок */
export function NewReviewForm({ members, deals }: { members: readonly Person[]; deals: readonly DealOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null)
  const ownDeals = useMemo(() => deals.filter((deal) => deal.ownerId === assigneeId), [deals, assigneeId])
  const titles = new Map(deals.map((deal) => [deal.id, deal.title]))

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        Выдать разбор
      </Button>
    )
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form
      className="grid gap-3 rounded-xl p-4 ring-1 ring-border"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await issueReviewPackageAction({ assigneeId: assigneeId ?? "", dealIds: [...selected], title, note, dueDate })
          if ("error" in result) return setMessage({ tone: "error", text: result.error })
          const failed = result.failed.map((item) => `«${titles.get(item.dealId) ?? item.dealId}»: ${item.message}`)
          setMessage(
            failed.length > 0
              ? { tone: "error", text: `Выдано: ${result.created}. Не удалось: ${failed.join("; ")}` }
              : { tone: "info", text: `Выдано задач: ${result.created}` }
          )
          if (result.created > 0) {
            setSelected(new Set())
            router.refresh()
          }
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="review-assignee">Сотрудник</Label>
          <Select
            items={members.map((member) => ({ value: member.id, label: member.name }))}
            value={assigneeId}
            onValueChange={(value) => {
              setAssigneeId(value)
              setSelected(new Set())
            }}
          >
            <SelectTrigger id="review-assignee" className="w-full">
              <SelectValue placeholder="Выберите менеджера" />
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
        <div className="grid gap-1.5">
          <Label htmlFor="review-due">Срок</Label>
          <Input id="review-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Сделки на разбор</legend>
        {!assigneeId ? (
          <p className="text-meta text-muted-foreground">Сначала выберите сотрудника.</p>
        ) : ownDeals.length === 0 ? (
          <p className="text-meta text-muted-foreground">У сотрудника нет открытых сделок.</p>
        ) : (
          <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg p-2 ring-1 ring-border sm:grid-cols-2">
            {ownDeals.map((deal) => (
              <li key={deal.id}>
                <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/50">
                  <input type="checkbox" checked={selected.has(deal.id)} onChange={() => toggle(deal.id)} className="size-4 accent-(--primary)" />
                  <span className="truncate">{deal.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="review-title">Что сделать</Label>
        <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Например: перезвонить и назначить встречу с ЛПР" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="review-note">Ошибка и комментарий</Label>
        <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Что было сделано не так и на что обратить внимание" />
      </div>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-destructive" : "text-sm text-success"}>
          {message.text}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || selected.size === 0}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Выдать {selected.size > 0 ? `(${selected.size})` : ""}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Закрыть
        </Button>
      </div>
    </form>
  )
}
