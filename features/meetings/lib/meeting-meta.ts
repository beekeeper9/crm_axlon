import { Building2, Car, Video, type LucideIcon } from "lucide-react"

import type { StatusTone } from "@/components/shared/status-badge"
import type { ClientConfirmation, MeetingFormat, MeetingPeriod, MeetingStatus } from "@/features/meetings/schemas"

export const MEETING_STATUS_META: Record<MeetingStatus, { label: string; tone: StatusTone }> = {
  scheduled: { label: "Назначена", tone: "info" },
  confirmed: { label: "Подтверждена", tone: "info" },
  held: { label: "Состоялась", tone: "success" },
  no_show: { label: "Не дошёл", tone: "danger" },
  rescheduled: { label: "Перенос", tone: "warning" },
  cancelled: { label: "Отменена", tone: "neutral" },
}

export const CLIENT_CONFIRMATION_META: Record<ClientConfirmation, { label: string; tone: StatusTone }> = {
  confirmed: { label: "Клиент подтвердил", tone: "success" },
  not_confirmed: { label: "Клиент не подтвердил", tone: "warning" },
  not_sent: { label: "Подтверждение не отправлялось", tone: "neutral" },
}

export const MEETING_FORMAT_META: Record<MeetingFormat, { label: string; icon: LucideIcon }> = {
  office: { label: "В офисе", icon: Building2 },
  online: { label: "Онлайн", icon: Video },
  visit: { label: "Выезд", icon: Car },
}

export const MEETING_PERIODS: readonly { value: MeetingPeriod; label: string }[] = [
  { value: "yesterday", label: "Вчера" },
  { value: "today", label: "Сегодня" },
  { value: "tomorrow", label: "Завтра" },
  { value: "week", label: "7 дней" },
]
