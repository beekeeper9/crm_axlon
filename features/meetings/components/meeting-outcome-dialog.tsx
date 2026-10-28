"use client"

import { useState } from "react"
import { CalendarClock, CircleCheckBig, UserX, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { DemoNotice } from "@/components/shared/demo-notice"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { meetingOutcomeFormSchema, type Meeting, type MeetingOutcomeFormValues } from "@/features/meetings/schemas"
import { formatDateTime } from "@/lib/format"

const RESULTS: readonly { value: MeetingOutcomeFormValues["result"]; label: string; icon: LucideIcon; tone: string }[] = [
  { value: "held", label: "Состоялась", icon: CircleCheckBig, tone: "has-checked:border-success has-checked:bg-success/10 [&_svg]:text-success" },
  { value: "no_show", label: "Не дошёл", icon: UserX, tone: "has-checked:border-destructive has-checked:bg-destructive/10 [&_svg]:text-destructive" },
  { value: "rescheduled", label: "Новая дата", icon: CalendarClock, tone: "has-checked:border-warning has-checked:bg-warning/10 [&_svg]:text-warning" },
]

type MeetingOutcomeDialogProps = {
  meeting: Meeting | null
  onOpenChange: (open: boolean) => void
  onSave: (meeting: Meeting, values: MeetingOutcomeFormValues) => void
}

export function MeetingOutcomeDialog({ meeting, onOpenChange, onSave }: MeetingOutcomeDialogProps) {
  return (
    <Dialog open={meeting !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {meeting && <OutcomeForm key={meeting.id} meeting={meeting} onCancel={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function OutcomeForm({ meeting, onCancel, onSave }: { meeting: Meeting; onCancel: () => void; onSave: MeetingOutcomeDialogProps["onSave"] }) {
  const [result, setResult] = useState<MeetingOutcomeFormValues["result"] | null>(null)
  const [rescheduledTo, setRescheduledTo] = useState("")
  const [comment, setComment] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!result) {
      setErrors({ result: "Выберите итог встречи" })
      return
    }
    const parsed = meetingOutcomeFormSchema.safeParse({ result, rescheduledTo, comment })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    onSave(meeting, parsed.data)
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Итог встречи</DialogTitle>
        <DialogDescription>
          {meeting.lead.name} · {formatDateTime(meeting.startsAt)}
        </DialogDescription>
      </DialogHeader>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Как прошло</legend>
        <div className="grid grid-cols-3 gap-2">
          {RESULTS.map(({ value, label, icon: Icon, tone }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-sm transition-colors hover:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring/60",
                tone
              )}
            >
              <input
                type="radio"
                name="meeting-result"
                className="sr-only"
                checked={result === value}
                onChange={() => {
                  setResult(value)
                  setErrors({})
                }}
              />
              <Icon className="size-4" aria-hidden />
              {label}
            </label>
          ))}
        </div>
        {errors.result && <p className="text-xs text-destructive">{errors.result}</p>}
      </fieldset>

      {result === "rescheduled" && (
        <div className="grid gap-2">
          <Label htmlFor="meeting-new-date">Новая дата и время</Label>
          <Input
            id="meeting-new-date"
            type="datetime-local"
            value={rescheduledTo}
            onChange={(event) => setRescheduledTo(event.target.value)}
            aria-invalid={Boolean(errors.rescheduledTo)}
          />
          {errors.rescheduledTo && <p className="text-xs text-destructive">{errors.rescheduledTo}</p>}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="meeting-comment">Комментарий</Label>
        <Textarea
          id="meeting-comment"
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Что решили, какие возражения, следующий шаг"
        />
      </div>

      <DemoNotice>Демо-режим: итог сохранится только на этой странице.</DemoNotice>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">Записать итог</Button>
      </DialogFooter>
    </form>
  )
}
