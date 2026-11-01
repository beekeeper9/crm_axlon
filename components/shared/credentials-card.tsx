"use client"

import { useState } from "react"
import { Check, Copy, KeyRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"

export type CredentialRow = { label: string; value: string; mono?: boolean }

type CredentialsCardProps = {
  title: string
  description: string
  rows: readonly CredentialRow[]
  login: string
  temporaryPassword: string
  /** Кнопки под данными («Создать ещё», «К списку») */
  actions?: React.ReactNode
}

/**
 * Данные первого входа. Пароль показан один раз: не сохраняется в браузере и не логируется;
 * после ухода со страницы получить его снова нельзя — только выдать новый (сброс пароля).
 */
export function CredentialsCard({ title, description, rows, login, temporaryPassword, actions }: CredentialsCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    const text = [
      `Доступ к CRM «${siteConfig.name}»`,
      ...rows.filter((row) => !row.mono).map((row) => `${row.label}: ${row.value}`),
      `Вход: ${window.location.origin}/login`,
      `Логин: ${login}`,
      `Временный пароль: ${temporaryPassword}`,
      "Войдите в систему и смените временный пароль при первом входе.",
    ].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  const all: CredentialRow[] = [...rows, { label: "Логин", value: login, mono: true }, { label: "Временный пароль", value: temporaryPassword, mono: true }]

  return (
    <section aria-labelledby="credentials-title" className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="credentials-title" className="text-base font-semibold">
            {title}
          </h2>
          <p className="text-meta text-muted-foreground">{description}</p>
        </div>
      </div>

      <dl className="divide-y rounded-xl bg-muted/30 ring-1 ring-success/30">
        {all.map((row) => (
          <div key={row.label} className="grid grid-cols-[9.5rem_1fr] gap-3 px-4 py-2.5 text-sm max-sm:grid-cols-1 max-sm:gap-0.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.mono ? "font-mono text-base font-semibold tracking-wide break-all select-all" : "font-medium"}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="flex items-start gap-2 text-meta text-muted-foreground">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        При первом входе система попросит придумать свой пароль. Временный пароль после этого перестанет работать.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={copy}>
          {copyState === "copied" ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
          {copyState === "copied" ? "Скопировано" : "Скопировать данные"}
        </Button>
        {actions}
      </div>
      <p aria-live="polite" className="min-h-4 text-xs">
        {copyState === "copied" && <span className="text-success">Текст с логином, паролем и инструкцией скопирован в буфер обмена.</span>}
        {copyState === "failed" && <span className="text-destructive">Браузер не дал доступ к буферу обмена — выделите данные выше и скопируйте вручную.</span>}
      </p>
    </section>
  )
}
