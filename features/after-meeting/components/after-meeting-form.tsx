"use client"

import { useState } from "react"
import { CalendarClock, CircleCheckBig, UserX, type LucideIcon } from "lucide-react"

import { DemoNotice } from "@/components/shared/demo-notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { afterMeetingFormSchema, type AfterMeetingFormValues, type AfterMeetingItem } from "@/features/after-meeting/schemas"
import { EDIT_UNAVAILABLE_HINT, type EditMode } from "@/lib/permissions/edit-mode"
import { cn } from "@/lib/utils"

const RESULTS: readonly { value: NonNullable<AfterMeetingFormValues["result"]>; label: string; icon: LucideIcon; tone: string }[] = [
  { value: "held", label: "Состоялась", icon: CircleCheckBig, tone: "has-checked:border-success has-checked:bg-success/10 [&_svg]:text-success" },
  { value: "no_show", label: "Не дошёл", icon: UserX, tone: "has-checked:border-destructive has-checked:bg-destructive/10 [&_svg]:text-destructive" },
  { value: "rescheduled", label: "Перенос", icon: CalendarClock, tone: "has-checked:border-warning has-checked:bg-warning/10 [&_svg]:text-warning" },
]

type FieldErrors = Partial<Record<keyof AfterMeetingFormValues, string>>

type AfterMeetingFormProps = {
  item: AfterMeetingItem
  editMode: EditMode
  onSubmit: (values: AfterMeetingFormValues) => void
}

/** Обработка лида после встречи: итог (если не записан), договорённости и следующий шаг */
export function AfterMeetingForm({ item, editMode, onSubmit }: AfterMeetingFormProps) {
  const needsResult = item.state === "outcome_required"
  const [values, setValues] = useState<AfterMeetingFormValues>({
    needsResult,
    result: null,
    rescheduledTo: "",
    summary: "",
    agreements: "",
    nextTitle: "",
    nextDueAt: "",
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const canEdit = editMode === "demo"

  function set<K extends keyof AfterMeetingFormValues>(key: K, value: AfterMeetingFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = afterMeetingFormSchema.safeParse(values)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof AfterMeetingFormValues] ??= issue.message
      setErrors(next)
      return
    }
    onSubmit(parsed.data)
  }

  if (editMode === "read-only") {
    return <p className="text-meta text-muted-foreground">Просмотр: у вашей роли нет права записывать итоги.</p>
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset disabled={!canEdit} className="space-y-4">
        {needsResult && (
          <div className="space-y-2">
            <p className="text-sm font-medium" id="after-result-label">Как прошла встреча</p>
            <div role="radiogroup" aria-labelledby="after-result-label" className="grid grid-cols-3 gap-2">
              {RESULTS.map(({ value, label, icon: Icon, tone }) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-colors hover:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring/60",
                    tone
                  )}
                >
                  <input
                    type="radio"
                    name={`after-result-${item.id}`}
                    className="sr-only"
                    checked={values.result === value}
                    onChange={() => set("result", value)}
                  />
                  <Icon className="size-4" aria-hidden />
                  {label}
                </label>
              ))}
            </div>
            {errors.result && <p className="text-xs text-destructive">{errors.result}</p>}
            {values.result === "rescheduled" && (
              <div className="grid gap-1.5">
                <Label htmlFor="after-rescheduled">Новая дата встречи</Label>
                <Input
                  id="after-rescheduled"
                  type="datetime-local"
                  value={values.rescheduledTo}
                  onChange={(event) => set("rescheduledTo", event.target.value)}
                  aria-invalid={Boolean(errors.rescheduledTo)}
                />
                {errors.rescheduledTo && <p className="text-xs text-destructive">{errors.rescheduledTo}</p>}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="after-summary">Краткий итог</Label>
          <Textarea
            id="after-summary"
            rows={2}
            value={values.summary}
            onChange={(event) => set("summary", event.target.value)}
            placeholder="Что важно знать о клиенте после встречи"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="after-agreements">Договорённости</Label>
          <Textarea
            id="after-agreements"
            rows={2}
            value={values.agreements}
            onChange={(event) => set("agreements", event.target.value)}
            placeholder="Например: пришлём расчёт до пятницы, клиент обсудит с семьёй"
          />
        </div>

        <div className="space-y-2 rounded-lg bg-muted/35 p-3">
          <p className="text-sm font-medium">Следующий шаг</p>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="grid gap-1.5">
              <Label htmlFor="after-next-title" className="text-xs text-muted-foreground">Что сделать</Label>
              <Input
                id="after-next-title"
                value={values.nextTitle}
                onChange={(event) => set("nextTitle", event.target.value)}
                placeholder="Позвонить и узнать решение"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="after-next-due" className="text-xs text-muted-foreground">Срок</Label>
              <Input
                id="after-next-due"
                type="datetime-local"
                value={values.nextDueAt}
                onChange={(event) => set("nextDueAt", event.target.value)}
                aria-invalid={Boolean(errors.nextDueAt)}
              />
            </div>
          </div>
          {errors.nextDueAt && <p className="text-xs text-destructive">{errors.nextDueAt}</p>}
          {!values.nextTitle && (
            <p className="text-xs text-muted-foreground">Если шаг не назначить, лид останется в группе «Нет следующего шага».</p>
          )}
        </div>
      </fieldset>

      {canEdit ? (
        <DemoNotice>Демо-режим: итог и задача сохранятся только на этой странице, на сервер ничего не уйдёт.</DemoNotice>
      ) : (
        <p className="text-xs text-muted-foreground">{EDIT_UNAVAILABLE_HINT}.</p>
      )}
      <Button type="submit" disabled={!canEdit}>
        <CircleCheckBig data-icon="inline-start" aria-hidden />
        {values.nextTitle ? "Сохранить итог и поставить задачу" : "Сохранить итог"}
      </Button>
    </form>
  )
}
