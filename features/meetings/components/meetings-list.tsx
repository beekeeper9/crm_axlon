"use client"

import { useState } from "react"
import { CalendarPlus, CalendarX2 } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MeetingFormDialog } from "@/features/meetings/components/meeting-form-dialog"
import { MeetingOutcomeDialog } from "@/features/meetings/components/meeting-outcome-dialog"
import { MeetingRow } from "@/features/meetings/components/meeting-row"
import type { Meeting, MeetingFormValues, MeetingOutcomeFormValues } from "@/features/meetings/schemas"
import { companyDateOf, companyWallTimeToIso } from "@/lib/datetime"
import { formatDateTime, formatNumber, formatWeekdayDate } from "@/lib/format"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type Person = { id: string; name: string }

type MeetingsListProps = {
  initialMeetings: readonly Meeting[]
  editMode: EditMode
  showPeople: boolean
  /** В карточке лида клиент известен: ссылка на него не нужна */
  lead: Person | null
  leadOptions: readonly Person[]
  hosts: readonly Person[]
  currentUser: Person
  emptyTitle: string
  emptyDescription: string
}

function groupByDay(meetings: readonly Meeting[]): { day: string; meetings: Meeting[] }[] {
  const groups = new Map<string, Meeting[]>()
  for (const meeting of meetings.toSorted((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const day = companyDateOf(meeting.startsAt)
    groups.set(day, [...(groups.get(day) ?? []), meeting])
  }
  return [...groups].map(([day, items]) => ({ day, meetings: items }))
}

export function MeetingsList({
  initialMeetings,
  editMode,
  showPeople,
  lead,
  leadOptions,
  hosts,
  currentUser,
  emptyTitle,
  emptyDescription,
}: MeetingsListProps) {
  const [meetings, setMeetings] = useState<readonly Meeting[]>(initialMeetings)
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set())
  const [outcomeFor, setOutcomeFor] = useState<Meeting | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const canEdit = editMode === "demo"

  function markChanged(id: string) {
    setChangedIds((current) => new Set(current).add(id))
  }

  function saveOutcome(meeting: Meeting, { result, rescheduledTo, comment }: MeetingOutcomeFormValues) {
    const rescheduleNote = result === "rescheduled" ? `Перенос на ${formatDateTime(companyWallTimeToIso(rescheduledTo))}` : null
    setMeetings((current) =>
      current.map((item) =>
        item.id === meeting.id
          ? {
              ...item,
              status: result,
              outcomeRequired: false,
              outcomeComment: [rescheduleNote, comment].filter(Boolean).join(". ") || null,
            }
          : item
      )
    )
    markChanged(meeting.id)
    setOutcomeFor(null)
  }

  function create(values: MeetingFormValues) {
    const id = `demo-${crypto.randomUUID()}`
    const host = hosts.find((item) => item.id === values.hostId) ?? currentUser
    const client = lead ?? leadOptions.find((item) => item.id === values.leadId)
    if (!client) return
    const created: Meeting = {
      id,
      startsAt: companyWallTimeToIso(values.startsAt),
      endsAt: null,
      lead: client,
      format: values.format,
      location: values.location || null,
      host,
      bookedBy: currentUser,
      status: "scheduled",
      clientConfirmation: "not_sent",
      outcomeRequired: false,
      notes: values.notes || null,
      outcomeComment: null,
    }
    setMeetings((current) => [...current, created])
    markChanged(id)
    setFormOpen(false)
  }

  const days = groupByDay(meetings)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {meetings.length > 0 ? `Встреч: ${formatNumber(meetings.length)}` : null}
        </p>
        {editMode !== "read-only" && (
          <Button size="sm" onClick={() => setFormOpen(true)} disabled={!canEdit} title={canEdit ? undefined : EDIT_UNAVAILABLE_HINT}>
            <CalendarPlus data-icon="inline-start" aria-hidden />
            Назначить встречу
          </Button>
        )}
      </div>

      {days.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarX2} title={emptyTitle} description={emptyDescription} />
        </Card>
      ) : (
        days.map(({ day, meetings: dayMeetings }) => (
          <section key={day} aria-labelledby={`meetings-${day}`} className="space-y-1.5">
            <h2 id={`meetings-${day}`} className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {formatWeekdayDate(`${day}T12:00:00Z`)}
            </h2>
            <Card className="py-0">
              <ul className="divide-y">
                {dayMeetings.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    showLead={lead === null}
                    showPeople={showPeople}
                    isDemoChanged={changedIds.has(meeting.id)}
                    editMode={editMode}
                    onRecordOutcome={setOutcomeFor}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}

      <MeetingOutcomeDialog meeting={outcomeFor} onOpenChange={(open) => !open && setOutcomeFor(null)} onSave={saveOutcome} />
      <MeetingFormDialog
        open={isFormOpen}
        lead={lead}
        leadOptions={leadOptions}
        hosts={hosts}
        currentUser={currentUser}
        onOpenChange={setFormOpen}
        onSave={create}
      />
    </div>
  )
}
