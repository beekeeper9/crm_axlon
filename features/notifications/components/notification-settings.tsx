"use client"

import { useState, useTransition } from "react"

import { ListPanel } from "@/components/shared/list-panel"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { NotificationPreferences } from "@/features/notifications/api/notifications-repository"
import { MAX_REMINDER_DAYS_BEFORE, type NotificationCategory } from "@/features/notifications/lib/categories"
import { savePreferenceAction } from "@/features/notifications/actions"

const CATEGORIES: readonly { value: NotificationCategory; label: string; description: string }[] = [
  { value: "task", label: "Задачи", description: "Напоминание о сроке, «задача просрочена», просрочки сотрудников (для РОПа)" },
  { value: "meeting", label: "Встречи", description: "Вам назначена встреча" },
  { value: "deal", label: "Сделки", description: "Новая сделка, где вы ответственный" },
  { value: "lead", label: "Лиды", description: "Поступил лид на вас" },
  { value: "payment", label: "Оплаты", description: "События по оплатам" },
  { value: "ai", label: "ИИ", description: "Готовые результаты ИИ-модуля" },
  { value: "system", label: "Система", description: "Служебные сообщения" },
]

function daysLabel(days: number): string {
  if (days === 0) return "В день срока"
  if (days === 1) return "За 1 день"
  return `За ${days} ${days < 5 ? "дня" : "дней"}`
}

/** Какие уведомления приходить в CRM и за сколько дней напоминать о сроке задачи */
export function NotificationSettings({ initial }: { initial: NotificationPreferences }) {
  const [preferences, setPreferences] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function save(change: Parameters<typeof savePreferenceAction>[0]) {
    startTransition(async () => {
      const result = await savePreferenceAction(change)
      if (result.ok) {
        setPreferences(result.preferences)
        setFailure(null)
        setSaved(true)
      } else {
        setFailure(result.message)
        setSaved(false)
      }
    })
  }

  const days = Array.from({ length: MAX_REMINDER_DAYS_BEFORE + 1 }, (_, value) => ({ value: String(value), label: daysLabel(value) }))
  const tasksOn = preferences.categories.task !== false

  return (
    <div className="space-y-4">
      <ListPanel>
        <ul className="divide-y">
          {CATEGORIES.map((category) => {
            const enabled = preferences.categories[category.value] !== false
            const id = `notify-${category.value}`
            return (
              <li key={category.value} className="flex items-start justify-between gap-4 px-4 py-3">
                <label htmlFor={id} className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium">{category.label}</span>
                  <span className="block text-meta text-muted-foreground">{category.description}</span>
                </label>
                <input
                  id={id}
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-(--primary)"
                  checked={enabled}
                  disabled={isPending}
                  onChange={(event) => save({ category: category.value, enabled: event.target.checked })}
                />
              </li>
            )
          })}
        </ul>
      </ListPanel>

      <section className="space-y-1.5 rounded-xl px-4 py-3 ring-1 ring-border">
        <Label htmlFor="reminder-days">Напоминать о сроке задачи</Label>
        <Select
          items={days}
          value={String(preferences.reminderDaysBefore)}
          onValueChange={(value) => value !== null && save({ reminderDaysBefore: Number(value) })}
          disabled={isPending || !tasksOn}
        >
          <SelectTrigger id="reminder-days" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-meta text-muted-foreground">
          {tasksOn
            ? "Срок задачи — дата, поэтому напоминание считается в днях. Наутро после срока придёт «задача просрочена»; если задача просрочена на 2 дня, об этом узнает РОП отдела. Проверка идёт каждые 15 минут."
            : "Уведомления о задачах выключены — напоминания не приходят."}
        </p>
      </section>

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      {saved && !failure && (
        <p role="status" className="text-meta text-muted-foreground">
          Сохранено.
        </p>
      )}
    </div>
  )
}
