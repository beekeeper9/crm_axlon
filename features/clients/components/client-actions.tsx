"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, CalendarPlus, Combine, LoaderCircle, NotebookPen, Pencil, Plus, UserRoundCog } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { leadRoute } from "@/config/routes"
import { LogCallButton } from "@/features/calls/components/log-call-button"
import {
  addClientNoteAction,
  assignClientAction,
  createClientDealAction,
  setClientArchivedAction,
  updateClientAction,
  type ClientActionResult,
} from "@/features/clients/actions"
import { ClientMergeDialog } from "@/features/clients/components/client-merge-dialog"
import { createClientMeetingAction } from "@/features/meetings/actions"
import { MeetingFormDialog } from "@/features/meetings/components/meeting-form-dialog"

type Person = { id: string; name: string }

type ClientActionsProps = {
  client: { id: string; name: string; phone: string | null; email: string | null }
  isArchived: boolean
  /** Дубль, объединённый с другой карточкой: только история, без действий */
  isMerged: boolean
  managerId: string | null
  /** Кому можно передать клиента; пусто — передавать нельзя (менеджер) */
  members: readonly Person[]
  /** Объединять дубли может директор и РОП; окончательно решает backend */
  canMerge: boolean
  /** Кто может проводить встречу (для менеджера — только он сам) */
  hosts: readonly Person[]
  currentUser: Person
}

type Mode = "idle" | "deal" | "assign" | "edit" | "note"

/** Действия с карточкой клиента. Права и правила окончательно проверяет backend */
export function ClientActions({ client, isArchived, isMerged, managerId, members, canMerge, hosts, currentUser }: ClientActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>("idle")
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [owner, setOwner] = useState<string | null>(managerId)
  const [contacts, setContacts] = useState({ name: client.name, phone: client.phone ?? "", email: client.email ?? "" })
  const [note, setNote] = useState("")
  const [isMeetingOpen, setMeetingOpen] = useState(false)
  const [isMergeOpen, setMergeOpen] = useState(false)

  if (isMerged) return null

  function toggle(next: Mode) {
    setFailure(null)
    setMode(mode === next ? "idle" : next)
  }

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
          <>
            <Button size="sm" onClick={() => toggle("deal")} disabled={isPending}>
              <Plus data-icon="inline-start" aria-hidden />
              Новая сделка
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)} disabled={isPending}>
              <CalendarPlus data-icon="inline-start" aria-hidden />
              Встреча
            </Button>
            <LogCallButton subject={{ type: "customer", id: client.id, name: client.name }} phone={client.phone} variant="outline" />
            <Button size="sm" variant="outline" onClick={() => toggle("note")} disabled={isPending}>
              <NotebookPen data-icon="inline-start" aria-hidden />
              Заметка
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggle("edit")} disabled={isPending}>
              <Pencil data-icon="inline-start" aria-hidden />
              Изменить
            </Button>
          </>
        )}
        {!isArchived && members.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => toggle("assign")} disabled={isPending}>
            <UserRoundCog data-icon="inline-start" aria-hidden />
            Передать
          </Button>
        )}
        {!isArchived && canMerge && (
          <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)} disabled={isPending}>
            <Combine data-icon="inline-start" aria-hidden />
            Объединить с дублем
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => act(() => setClientArchivedAction(client.id, !isArchived))} disabled={isPending}>
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
            act(() => createClientDealAction(client.id, { title, amount }), (dealId) => router.push(leadRoute(dealId)))
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

      {mode === "edit" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            act(() => updateClientAction(client.id, contacts))
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="client-name">Имя или название</Label>
            <Input id="client-name" value={contacts.name} onChange={(e) => setContacts({ ...contacts, name: e.target.value })} maxLength={200} className="h-9" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-phone">Телефон</Label>
            <Input
              id="client-phone"
              type="tel"
              value={contacts.phone}
              onChange={(e) => setContacts({ ...contacts, phone: e.target.value })}
              placeholder="+996555123456"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-email">E-mail</Label>
            <Input id="client-email" type="email" value={contacts.email} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} className="h-9" />
          </div>
          <p className="text-meta text-muted-foreground">Пустое поле удаляет телефон или e-mail из карточки.</p>
          <Button type="submit" size="sm" disabled={isPending} className="w-fit">
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Сохранить
          </Button>
        </form>
      )}

      {mode === "note" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            act(
              () => addClientNoteAction(client.id, note),
              () => {
                setNote("")
                router.refresh()
              }
            )
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="client-note">Заметка</Label>
            <Textarea id="client-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} />
          </div>
          <Button type="submit" size="sm" disabled={isPending || !note.trim()} className="w-fit">
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Добавить в историю
          </Button>
        </form>
      )}

      {mode === "assign" && (
        <form
          className="grid gap-3 rounded-lg p-3 ring-1 ring-border"
          onSubmit={(event) => {
            event.preventDefault()
            if (owner) act(() => assignClientAction(client.id, owner))
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

      <MeetingFormDialog
        open={isMeetingOpen}
        lead={{ id: client.id, name: client.name }}
        leadOptions={[]}
        hosts={hosts}
        currentUser={currentUser}
        isServer
        onOpenChange={setMeetingOpen}
        onSave={async (values) => {
          const error = await createClientMeetingAction(client.id, client.name, values)
          if (!error) {
            setMeetingOpen(false)
            router.refresh()
          }
          return error
        }}
      />
      {canMerge && <ClientMergeDialog open={isMergeOpen} onOpenChange={setMergeOpen} target={{ id: client.id, name: client.name }} />}
    </section>
  )
}
