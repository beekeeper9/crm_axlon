"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateCompanySettingsAction, type SettingsActionResult, type SettingsInput } from "@/features/company-settings/actions"
import type { CompanySettings } from "@/features/company-settings/api/company-settings"
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  TIMEZONE_OPTIONS,
  withCurrent,
  type SettingOption,
} from "@/features/company-settings/lib/settings-options"

type Field = keyof SettingsInput

const SELECTS: readonly { field: Exclude<Field, "name">; label: string; hint: string; options: readonly SettingOption[] }[] = [
  { field: "country", label: "Страна", hint: "Для форматов телефонов и документов.", options: COUNTRY_OPTIONS },
  { field: "currency", label: "Валюта по умолчанию", hint: "Подставляется в новые сделки и планы; уже созданные суммы не меняются.", options: CURRENCY_OPTIONS },
  { field: "timezone", label: "Часовой пояс", hint: "Определяет границы дня, недели и месяца во всех отчётах и планах.", options: TIMEZONE_OPTIONS },
]

/** Название, страна, валюта и часовой пояс компании. Сохраняет директор; backend проверяет право ещё раз */
export function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<SettingsInput>({
    name: settings.name,
    country: settings.country,
    currency: settings.currency,
    timezone: settings.timezone,
  })
  const [result, setResult] = useState<SettingsActionResult | "saved" | undefined>(undefined)
  const failure = result && result !== "saved" ? result : null
  const changedFields = (Object.keys(values) as Field[]).filter((field) => values[field] !== settings[field])
  const changed = changedFields.length > 0

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setResult(undefined)
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const next = await updateCompanySettingsAction(Object.fromEntries(changedFields.map((field) => [field, values[field]])))
          setResult(next ?? "saved")
          if (!next) router.refresh()
        })
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="company-name">Название компании</Label>
        <Input
          id="company-name"
          value={values.name}
          maxLength={200}
          onChange={(event) => set("name", event.target.value)}
          aria-invalid={Boolean(failure?.fieldErrors.name)}
          aria-describedby={failure?.fieldErrors.name ? "company-name-error" : undefined}
          className="h-10"
        />
        {failure?.fieldErrors.name && (
          <p id="company-name-error" className="text-meta text-destructive">
            {failure.fieldErrors.name}
          </p>
        )}
      </div>

      {SELECTS.map(({ field, label, hint, options }) => {
        const error = failure?.fieldErrors[field]
        const items = withCurrent(options, settings[field])
        return (
          <div key={field} className="grid gap-1.5">
            <Label htmlFor={`company-${field}`}>{label}</Label>
            <Select items={items} value={values[field]} onValueChange={(value) => value && set(field, value)}>
              <SelectTrigger id={`company-${field}`} className="h-10 w-full sm:w-80" aria-invalid={Boolean(error)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className={error ? "text-meta text-destructive" : "text-meta text-muted-foreground"}>{error ?? hint}</p>
          </div>
        )
      })}

      {failure && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          {failure.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending || !changed}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Сохранить
        </Button>
        {result === "saved" && !changed && (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden />
            Настройки сохранены
          </p>
        )}
      </div>
    </form>
  )
}
