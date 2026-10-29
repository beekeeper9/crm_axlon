"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Check, CircleAlert, Copy, KeyRound, LoaderCircle, UserPlus } from "lucide-react"

import { DemoNotice } from "@/components/shared/demo-notice"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { siteConfig } from "@/config/site"
import { createStaffAccount, type CreateStaffState } from "@/features/staff/actions"
import type { CreateOptions } from "@/features/staff/schemas"
import { ROLE_LABELS } from "@/lib/permissions/roles"

type CreateStaffFlowProps = {
  options: CreateOptions
  backHref: string
  isDemo: boolean
}

/** «Создать ещё одного» — новая форма с чистым состоянием */
export function CreateStaffFlow(props: CreateStaffFlowProps) {
  const [round, setRound] = useState(0)
  return <CreateStaffRound key={round} {...props} onCreateAnother={() => setRound((value) => value + 1)} />
}

const INITIAL_STATE: CreateStaffState = { status: "idle" }

function CreateStaffRound({ options, backHref, isDemo, onCreateAnother }: CreateStaffFlowProps & { onCreateAnother: () => void }) {
  const [state, formAction, isPending] = useActionState(createStaffAccount, INITIAL_STATE)
  const [departmentId, setDepartmentId] = useState<string | null>(state.status === "error" ? state.values.departmentId || null : null)

  if (state.status === "created") {
    return <CredentialsResult account={state.account} backHref={backHref} isDemo={isDemo} onCreateAnother={onCreateAnother} />
  }

  const errors = state.status === "error" ? state.fieldErrors : {}
  const values = state.status === "error" ? state.values : null
  const roleLabel = options.creatableRole ? ROLE_LABELS[options.creatableRole] : null

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {roleLabel && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-meta">
          Будет создан аккаунт: <strong className="font-medium">{roleLabel}</strong>
          {options.fixedDepartment && <> · отдел «{options.fixedDepartment.name}»</>}. Роль назначает система по вашим правам.
        </p>
      )}

      {options.requiresCompanyName && (
        <Field id="companyName" label="Компания" error={errors.companyName} hint="Для директора создаётся новая компания">
          <Input id="companyName" name="companyName" defaultValue={values?.companyName} placeholder="ОсОО «Название»" aria-invalid={Boolean(errors.companyName)} className="h-10" />
        </Field>
      )}

      <Field id="fullName" label="Имя и фамилия" error={errors.fullName}>
        <Input id="fullName" name="fullName" defaultValue={values?.fullName} autoComplete="off" autoFocus aria-invalid={Boolean(errors.fullName)} className="h-10" />
      </Field>

      <Field
        id="login"
        label={options.loginIsOptional ? "Логин (необязательно)" : "Логин"}
        error={errors.login}
        hint="Если оставить пустым, система придумает логин сама"
      >
        <Input id="login" name="login" defaultValue={values?.login} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="например, a.sadykov" aria-invalid={Boolean(errors.login)} className="h-10" />
      </Field>

      {options.departments.length > 0 && (
        <Field id="departmentId" label="Отдел" error={errors.departmentId}>
          <input type="hidden" name="departmentId" value={departmentId ?? ""} />
          <Select items={options.departments.map((item) => ({ value: item.id, label: item.name }))} value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger id="departmentId" className="h-10 w-full" aria-invalid={Boolean(errors.departmentId)}>
              <SelectValue placeholder="Выберите отдел" />
            </SelectTrigger>
            <SelectContent>
              {options.departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {state.status === "error" && state.message && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            {state.message}
            {state.requestId && <span className="block text-xs text-muted-foreground">Код запроса: {state.requestId}</span>}
          </span>
        </p>
      )}

      {isDemo && <DemoNotice>Демо-режим: аккаунт создаётся в тестовом хранилище и пропадёт после перезапуска сервера.</DemoNotice>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <UserPlus data-icon="inline-start" aria-hidden />}
          Создать аккаунт
        </Button>
        <Link href={backHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Отмена
        </Link>
      </div>
    </form>
  )
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

type CreatedAccountView = Extract<CreateStaffState, { status: "created" }>["account"]

function credentialsText(account: CreatedAccountView): string {
  return [
    `Доступ к CRM «${siteConfig.name}»`,
    `Сотрудник: ${account.fullName}`,
    `Вход: ${window.location.origin}/login`,
    `Логин: ${account.login}`,
    `Временный пароль: ${account.temporaryPassword}`,
    "Войдите в систему и смените временный пароль при первом входе.",
  ].join("\n")
}

/**
 * Данные нового аккаунта. Пароль показан один раз: не сохраняется в браузере и не логируется;
 * после ухода со страницы получить его снова нельзя — только выдать новый (когда появится API сброса).
 */
function CredentialsResult({
  account,
  backHref,
  isDemo,
  onCreateAnother,
}: {
  account: CreatedAccountView
  backHref: string
  isDemo: boolean
  onCreateAnother: () => void
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    try {
      await navigator.clipboard.writeText(credentialsText(account))
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
  }

  const rows = [
    { label: "Сотрудник", value: account.fullName },
    { label: "Роль", value: [account.roleLabel, account.place].filter(Boolean).join(" · ") },
    { label: "Статус", value: "Ожидает первого входа" },
    { label: "Логин", value: account.login, mono: true },
    { label: "Временный пароль", value: account.temporaryPassword, mono: true },
  ]

  return (
    <section aria-labelledby="created-title" className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="created-title" className="text-base font-semibold">
            Аккаунт создан
          </h2>
          <p className="text-meta text-muted-foreground">Передайте эти данные сотруднику. Пароль показывается только сейчас.</p>
        </div>
      </div>

      <dl className="divide-y rounded-xl bg-muted/30 ring-1 ring-success/30">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[9.5rem_1fr] gap-3 px-4 py-2.5 text-sm max-sm:grid-cols-1 max-sm:gap-0.5">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.mono ? "font-mono text-base font-semibold tracking-wide break-all select-all" : "font-medium"}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="flex items-start gap-2 text-meta text-muted-foreground">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        При первом входе система попросит сотрудника придумать свой пароль. Временный пароль после этого перестанет работать.
      </p>

      {isDemo && <DemoNotice>Демо-режим: это тестовые учётные данные, они работают только в демо и до перезапуска сервера.</DemoNotice>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={copy}>
          {copyState === "copied" ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
          {copyState === "copied" ? "Скопировано" : "Скопировать данные"}
        </Button>
        <Button size="lg" variant="outline" onClick={onCreateAnother}>
          <UserPlus data-icon="inline-start" aria-hidden />
          Создать ещё одного
        </Button>
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          К списку сотрудников
        </Link>
      </div>
      <p aria-live="polite" className="min-h-4 text-xs">
        {copyState === "copied" && <span className="text-success">Текст с логином, паролем и инструкцией скопирован в буфер обмена.</span>}
        {copyState === "failed" && <span className="text-destructive">Браузер не дал доступ к буферу обмена — выделите данные выше и скопируйте вручную.</span>}
      </p>
    </section>
  )
}
