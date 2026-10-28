"use client"

import { useState } from "react"

import { DemoNotice } from "@/components/shared/demo-notice"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MEETING_FORMAT_META } from "@/features/meetings/lib/meeting-meta"
import { meetingFormatSchema, meetingFormSchema, type MeetingFormValues } from "@/features/meetings/schemas"

type Option = { id: string; name: string }

type MeetingFormDialogProps = {
  open: boolean
  /** Встреча из карточки лида — клиент уже выбран */
  lead: Option | null
  leadOptions: readonly Option[]
  hosts: readonly Option[]
  currentUser: Option
  onOpenChange: (open: boolean) => void
  onSave: (values: MeetingFormValues) => void
}

export function MeetingFormDialog({ open, onOpenChange, ...props }: MeetingFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <MeetingForm onCancel={() => onOpenChange(false)} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function SelectField({
  id,
  label,
  value,
  options,
  placeholder,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  placeholder?: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select items={options} value={value || null} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function MeetingForm({
  lead,
  leadOptions,
  hosts,
  currentUser,
  onSave,
  onCancel,
}: Omit<MeetingFormDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [values, setValues] = useState<MeetingFormValues>({
    leadId: lead?.id ?? "",
    startsAt: "",
    format: "office",
    location: "",
    hostId: currentUser.id,
    notes: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof MeetingFormValues, string>>>({})

  function set<K extends keyof MeetingFormValues>(key: K, value: MeetingFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = meetingFormSchema.safeParse(values)
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof MeetingFormValues] ??= issue.message
      setErrors(next)
      return
    }
    onSave(parsed.data)
  }

  const hostOptions = (hosts.some((host) => host.id === currentUser.id) ? hosts : [currentUser, ...hosts]).map((host) => ({
    value: host.id,
    label: host.name,
  }))

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Назначить встречу</DialogTitle>
        {lead && <DialogDescription>{lead.name}</DialogDescription>}
      </DialogHeader>

      {!lead && (
        <SelectField
          id="meeting-lead"
          label="Клиент"
          value={values.leadId}
          placeholder="Выберите лид"
          options={leadOptions.map((option) => ({ value: option.id, label: option.name }))}
          error={errors.leadId}
          onChange={(value) => set("leadId", value)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="meeting-starts">Дата и время</Label>
          <Input
            id="meeting-starts"
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => set("startsAt", event.target.value)}
            aria-invalid={Boolean(errors.startsAt)}
          />
          {errors.startsAt && <p className="text-xs text-destructive">{errors.startsAt}</p>}
        </div>
        <SelectField
          id="meeting-format"
          label="Формат"
          value={values.format}
          options={meetingFormatSchema.options.map((format) => ({ value: format, label: MEETING_FORMAT_META[format].label }))}
          onChange={(value) => set("format", meetingFormatSchema.parse(value))}
        />
      </div>

      {hostOptions.length > 1 && (
        <SelectField
          id="meeting-host"
          label="Проводит"
          value={values.hostId}
          options={hostOptions}
          error={errors.hostId}
          onChange={(value) => set("hostId", value)}
        />
      )}

      {values.format !== "online" && (
        <div className="grid gap-2">
          <Label htmlFor="meeting-location">Место</Label>
          <Input
            id="meeting-location"
            value={values.location}
            onChange={(event) => set("location", event.target.value)}
            placeholder="Например: офис, переговорная 2"
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="meeting-notes">Заметка к встрече</Label>
        <Textarea id="meeting-notes" rows={3} value={values.notes} onChange={(event) => set("notes", event.target.value)} />
      </div>

      <DemoNotice>
        Демо-режим: встреча появится только на этой странице. Напоминания клиенту отправляет backend — здесь они не уходят.
      </DemoNotice>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">Назначить</Button>
      </DialogFooter>
    </form>
  )
}
