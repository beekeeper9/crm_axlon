"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, PhoneCall } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { logCallAction, type CallLogInput } from "@/features/calls/actions"
import type { CallSubject } from "@/features/calls/api/calls-repository"

const DIRECTIONS = [
  { value: "outbound", label: "Исходящий" },
  { value: "inbound", label: "Входящий" },
] as const

const STATUSES = [
  { value: "completed", label: "Состоялся" },
  { value: "missed", label: "Без ответа" },
  { value: "failed", label: "Не соединился" },
] as const

const EMPTY: CallLogInput = {
  direction: "outbound",
  clientPhone: "",
  linePhone: "",
  status: "completed",
  startedAt: "",
  durationMinutes: "0",
  durationSeconds: "0",
  notes: "",
}

type LogCallButtonProps = {
  /** Карточка сделки или клиента: звонок сразу привязывается к ним */
  subject?: CallSubject & { name: string }
  /** Номер клиента, если он известен карточке */
  phone?: string | null
  variant?: "default" | "outline"
}

/** Записать звонок, который уже состоялся (например, с мобильного): телефония для этого не нужна */
export function LogCallButton({ subject, phone, variant = "default" }: LogCallButtonProps = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const initial: CallLogInput = { ...EMPTY, clientPhone: phone ?? "" }
  const [values, setValues] = useState<CallLogInput>(initial)
  const [failure, setFailure] = useState<string | null>(null)
  const set = <K extends keyof CallLogInput>(key: K, value: CallLogInput[K]) => setValues((current) => ({ ...current, [key]: value }))

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <PhoneCall data-icon="inline-start" aria-hidden />
        Записать звонок
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Записать звонок</DialogTitle>
            <DialogDescription>
              {subject ? `${subject.name}. ` : ""}Для звонка, который уже состоялся. Время — по часовому поясу компании.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              startTransition(async () => {
                const error = await logCallAction(values, subject ? { type: subject.type, id: subject.id } : null)
                setFailure(error)
                if (!error) {
                  setOpen(false)
                  setValues(initial)
                  router.refresh()
                }
              })
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="call-direction">Направление</Label>
                <Select items={[...DIRECTIONS]} value={values.direction} onValueChange={(value) => value && set("direction", value)}>
                  <SelectTrigger id="call-direction" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="call-status">Итог</Label>
                <Select items={[...STATUSES]} value={values.status} onValueChange={(value) => value && set("status", value)}>
                  <SelectTrigger id="call-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="call-client">Номер клиента</Label>
                <Input id="call-client" type="tel" value={values.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="+996555123456" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="call-line">Номер компании</Label>
                <Input id="call-line" type="tel" value={values.linePhone} onChange={(e) => set("linePhone", e.target.value)} placeholder="+996312000000" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="call-start">Когда</Label>
                <Input id="call-start" type="datetime-local" value={values.startedAt} onChange={(e) => set("startedAt", e.target.value)} />
              </div>
              {values.status === "completed" && (
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium">Длительность</legend>
                  <div className="flex items-center gap-2">
                    <Input aria-label="Минуты" inputMode="numeric" value={String(values.durationMinutes)} onChange={(e) => set("durationMinutes", e.target.value)} className="w-16" />
                    <span className="text-meta text-muted-foreground">мин</span>
                    <Input aria-label="Секунды" inputMode="numeric" value={String(values.durationSeconds)} onChange={(e) => set("durationSeconds", e.target.value)} className="w-16" />
                    <span className="text-meta text-muted-foreground">сек</span>
                  </div>
                </fieldset>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="call-notes">Заметка</Label>
              <Textarea id="call-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            {failure && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {failure}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                Записать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
