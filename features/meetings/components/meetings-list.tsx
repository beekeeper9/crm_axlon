"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarPlus, CalendarX2 } from "lucide-react"

import { leadRoute } from "@/config/routes"
import { EmptyState } from "@/components/shared/empty-state"
import { ListGroup, ListPanel } from "@/components/shared/list-panel"
import { Button } from "@/components/ui/button"
import { createMeetingAction, recordMeetingOutcomeAction } from "@/features/meetings/actions"
import { MeetingActions } from "@/features/meetings/components/meeting-actions"
import { MeetingFormDialog } from "@/features/meetings/components/meeting-form-dialog"
import { MeetingOutcomeDialog } from "@/features/meetings/components/meeting-outcome-dialog"
import { MeetingRow } from "@/features/meetings/components/meeting-row"
import type { Meeting, MeetingFormValues, MeetingOutcomeFormValues } from "@/features/meetings/schemas"
import { companyDateOf, companyWallTimeToIso } from "@/lib/datetime"
import { formatDateTime, formatNumber, formatWeekdayDate, pluralize } from "@/lib/format"
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
  /** Заголовок над списком (в карточке лида); без него — количество встреч */
  heading?: string
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
  heading,
}: MeetingsListProps) {
  const [demoMeetings, setMeetings] = useState<readonly Meeting[]>(initialMeetings)
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set())
  const [outcomeFor, setOutcomeFor] = useState<Meeting | null>(null)
  const [isFormOpen, setFormOpen] = useState(false)
  const [nextStepFor, setNextStepFor] = useState<Person | null>(null)
  const router = useRouter()
  const canEdit = editMode === "demo"
  // Через backend: назначить встречу по сделке и записать итог; права окончательно проверяет он
  const isServer = editMode === "unavailable"
  const canCreate = canEdit || (isServer && (lead !== null || leadOptions.length > 0))
  // Через backend список — всегда ответ сервера: после router.refresh приходят новые props
  const meetings = isServer ? initialMeetings : demoMeetings

  function markChanged(id: string) {
    setChangedIds((current) => new Set(current).add(id))
  }

  async function saveOutcomeRemote(meeting: Meeting, values: MeetingOutcomeFormValues): Promise<string | null> {
    const error = await recordMeetingOutcomeAction(meeting.id, values)
    if (!error) {
      setOutcomeFor(null)
      // Итог — повод сразу поставить следующий шаг по сделке (дожим, новая встреча или закрытие)
      setNextStepFor(meeting.lead.id ? meeting.lead : null)
      router.refresh()
    }
    return error
  }

  async function createRemote(values: MeetingFormValues): Promise<string | null> {
    const client = lead ?? leadOptions.find((item) => item.id === values.leadId)
    if (!client) return "Выберите сделку"
    const error = await createMeetingAction(values, client.name)
    if (!error) {
      setFormOpen(false)
      router.refresh()
    }
    return error
  }

  function saveOutcome(meeting: Meeting, { result, rescheduledTo, comment }: MeetingOutcomeFormValues) {
    const rescheduleNote = result === "rescheduled" && rescheduledTo ? `Перенос на ${formatDateTime(companyWallTimeToIso(rescheduledTo))}` : null
    setMeetings((current) =>
      current.map((item) =>
        item.id === meeting.id
          ? {
              ...item,
              // Перенос с датой — снова запланированная встреча; без даты — «перенос без даты»
              status: result === "rescheduled" && rescheduledTo ? "scheduled" : result,
              ...(result === "rescheduled" && rescheduledTo ? { startsAt: companyWallTimeToIso(rescheduledTo), endsAt: null } : {}),
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
        {heading ? (
          <h2 className="text-sm font-semibold">{heading}</h2>
        ) : (
          <p className="text-meta text-muted-foreground">
            {meetings.length > 0 ? `${formatNumber(meetings.length)} ${pluralize(meetings.length, ["встреча", "встречи", "встреч"])}` : null}
          </p>
        )}
        {editMode !== "read-only" && (
          <Button size="sm" onClick={() => setFormOpen(true)} disabled={!canCreate} title={canCreate ? undefined : EDIT_UNAVAILABLE_HINT}>
            <CalendarPlus data-icon="inline-start" aria-hidden />
            Назначить встречу
          </Button>
        )}
      </div>

      {nextStepFor && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-lg bg-primary/8 px-3 py-2 text-sm" role="status">
          Итог записан. Следующий шаг по сделке «{nextStepFor.name}»: задача, новая встреча или закрытие —
          <Link href={leadRoute(nextStepFor.id)} className="font-medium text-primary hover:underline">
            открыть сделку
          </Link>
        </p>
      )}

      {days.length === 0 ? (
        <ListPanel>
          <EmptyState icon={CalendarX2} title={emptyTitle} description={emptyDescription} />
        </ListPanel>
      ) : (
        <ListPanel>
          {days.map(({ day, meetings: dayMeetings }) => (
            <ListGroup
              key={day}
              id={`meetings-${day}`}
              title={formatWeekdayDate(`${day}T12:00:00Z`)}
              count={dayMeetings.length}
            >
              {dayMeetings.map((meeting) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  showLead={lead === null}
                  showPeople={showPeople}
                  isDemoChanged={changedIds.has(meeting.id)}
                  editMode={editMode}
                  onRecordOutcome={setOutcomeFor}
                  actions={isServer ? <MeetingActions meeting={meeting} /> : undefined}
                />
              ))}
            </ListGroup>
          ))}
        </ListPanel>
      )}

      <MeetingOutcomeDialog
        meeting={outcomeFor}
        isServer={isServer}
        onOpenChange={(open) => !open && setOutcomeFor(null)}
        onSave={isServer ? saveOutcomeRemote : saveOutcome}
      />
      <MeetingFormDialog
        open={isFormOpen}
        lead={lead}
        leadOptions={leadOptions}
        hosts={hosts}
        currentUser={currentUser}
        isServer={isServer}
        onOpenChange={setFormOpen}
        onSave={isServer ? createRemote : create}
      />
    </div>
  )
}
