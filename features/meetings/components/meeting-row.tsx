"use client"

import Link from "next/link"
import { ClipboardCheck, MapPin } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { leadRoute } from "@/config/routes"
import { CLIENT_CONFIRMATION_META, MEETING_FORMAT_META, MEETING_STATUS_META } from "@/features/meetings/lib/meeting-meta"
import type { Meeting } from "@/features/meetings/schemas"
import { formatTime } from "@/lib/format"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"

type MeetingRowProps = {
  meeting: Meeting
  showLead: boolean
  showPeople: boolean
  isDemoChanged: boolean
  editMode: EditMode
  onRecordOutcome: (meeting: Meeting) => void
}

export function MeetingRow({ meeting, showLead, showPeople, isDemoChanged, editMode, onRecordOutcome }: MeetingRowProps) {
  const status = MEETING_STATUS_META[meeting.status]
  const confirmation = CLIENT_CONFIRMATION_META[meeting.clientConfirmation]
  const format = MEETING_FORMAT_META[meeting.format]
  const isUpcoming = meeting.status === "scheduled" || meeting.status === "confirmed"

  return (
    <li className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex shrink-0 items-baseline gap-2 sm:w-24 sm:flex-col sm:gap-0">
        <time dateTime={meeting.startsAt} className="text-base font-semibold tabular-nums">
          {formatTime(meeting.startsAt)}
        </time>
        {meeting.endsAt && <span className="text-meta text-muted-foreground tabular-nums">до {formatTime(meeting.endsAt)}</span>}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showLead ? (
            <Link href={leadRoute(meeting.lead.id)} className="font-medium hover:text-primary hover:underline">
              {meeting.lead.name}
            </Link>
          ) : (
            <span className="font-medium">{format.label}</span>
          )}
          {meeting.outcomeRequired ? (
            <StatusBadge tone="warning">Нужен итог</StatusBadge>
          ) : (
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          )}
          {isUpcoming && <StatusBadge tone={confirmation.tone}>{confirmation.label}</StatusBadge>}
          {isDemoChanged && <span className="text-xs text-warning">демо · не сохранено</span>}
        </div>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-meta text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <format.icon className="size-3.5" aria-hidden />
            {format.label}
          </span>
          {meeting.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {meeting.location}
            </span>
          )}
          {showPeople && (
            <span>
              Проводит {meeting.host.name}
              {meeting.bookedBy.id !== meeting.host.id && ` · назначил(а) ${meeting.bookedBy.name}`}
            </span>
          )}
        </p>

        {meeting.notes && <p className="text-meta text-foreground/85">{meeting.notes}</p>}
        {meeting.outcomeComment && (
          <p className="text-meta text-muted-foreground">
            <span className="font-medium text-foreground/80">Итог:</span> {meeting.outcomeComment}
          </p>
        )}
      </div>

      {meeting.outcomeRequired && editMode !== "read-only" && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 self-start"
          disabled={editMode !== "demo"}
          title={editMode === "demo" ? undefined : EDIT_UNAVAILABLE_HINT}
          onClick={() => onRecordOutcome(meeting)}
        >
          <ClipboardCheck data-icon="inline-start" aria-hidden />
          Записать итог
        </Button>
      )}
    </li>
  )
}
