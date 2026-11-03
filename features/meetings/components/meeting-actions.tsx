"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, CalendarX2, CheckCheck, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cancelMeetingAction, confirmMeetingAction, rescheduleMeetingAction, type MeetingActionResult } from "@/features/meetings/actions"
import { ReasonChips } from "@/features/meetings/components/reason-chips"
import type { Meeting } from "@/features/meetings/schemas"
import { formatDateTime } from "@/lib/format"

/** Подтверждение, перенос и отмена встречи через backend (статус — всегда ответ сервера) */
export function MeetingActions({ meeting, cancelReasons = [] }: { meeting: Meeting; cancelReasons?: readonly string[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [dialog, setDialog] = useState<"reschedule" | "cancel" | null>(null)
  const [startsAt, setStartsAt] = useState("")
  const [reason, setReason] = useState("")
  const isPlanned = meeting.status === "scheduled" || meeting.status === "confirmed"
  const canConfirm = meeting.status === "scheduled" && meeting.clientConfirmation !== "confirmed" && !meeting.outcomeRequired
  const canMove = isPlanned || meeting.status === "rescheduled"
  if (!canConfirm && !canMove) return null

  function act(operation: () => Promise<MeetingActionResult>) {
    startTransition(async () => {
      const error = await operation()
      setFailure(error)
      if (!error) {
        setDialog(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {canConfirm && (
          <Button size="sm" variant="ghost" onClick={() => act(() => confirmMeetingAction(meeting.id))} disabled={isPending}>
            {isPending && !dialog ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <CheckCheck data-icon="inline-start" aria-hidden />}
            Подтвердить
          </Button>
        )}
        {canMove && (
          <Button size="sm" variant="ghost" onClick={() => setDialog("reschedule")} disabled={isPending}>
            <CalendarClock data-icon="inline-start" aria-hidden />
            {meeting.status === "rescheduled" ? "Назначить дату" : "Перенести"}
          </Button>
        )}
        {canMove && (
          <Button size="sm" variant="ghost" onClick={() => setDialog("cancel")} disabled={isPending}>
            <CalendarX2 data-icon="inline-start" aria-hidden />
            Отменить
          </Button>
        )}
      </div>
      {failure && !dialog && (
        <p role="alert" className="text-xs text-destructive">
          {failure}
        </p>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <form
            className="grid gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              act(() => (dialog === "cancel" ? cancelMeetingAction(meeting.id, reason) : rescheduleMeetingAction(meeting.id, startsAt)))
            }}
          >
            <DialogHeader>
              <DialogTitle>{dialog === "cancel" ? "Отменить встречу" : "Перенести встречу"}</DialogTitle>
              <DialogDescription>
                {meeting.lead.name} · {formatDateTime(meeting.startsAt)}
              </DialogDescription>
            </DialogHeader>
            {dialog === "cancel" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="meeting-cancel-reason">Причина</Label>
                <ReasonChips reasons={cancelReasons} value={reason} onPick={setReason} />
                <Textarea id="meeting-cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="meeting-reschedule-at">Новая дата и время</Label>
                <Input id="meeting-reschedule-at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                <p className="text-xs text-muted-foreground">Длительность сохранится 60 минут.</p>
              </div>
            )}
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Назад
              </Button>
              <Button type="submit" variant={dialog === "cancel" ? "destructive" : "default"} disabled={isPending}>
                {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                {dialog === "cancel" ? "Отменить встречу" : "Перенести"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
