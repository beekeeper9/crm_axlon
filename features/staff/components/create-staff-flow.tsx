"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { CircleAlert, LoaderCircle, Send, UserPlus } from "lucide-react"

import { CredentialsCard } from "@/components/shared/credentials-card"
import { DemoNotice } from "@/components/shared/demo-notice"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createStaffAccount, type CreateStaffState } from "@/features/staff/actions"
import { DEPARTMENT_HAS_HEAD_MESSAGE } from "@/features/staff/lib/staff-messages"
import type { CreateOptions } from "@/features/staff/schemas"
import { ROLE_LABELS, type Role } from "@/lib/permissions/roles"

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
  const [role, setRole] = useState<Role | null>(options.creatableRole)
  const isRequest = options.mode === "request"
  // В отделе не больше одного РОПа: отделы, где он уже есть, для новой роли РОПа закрыты
  const headTaken = (id: string) => role === "head_of_sales" && options.departmentsWithHead.includes(id)
  const noFreeDepartment = role === "head_of_sales" && options.departments.length > 0 && options.departments.every((d) => headTaken(d.id))

  if (state.status === "created") {
    const { account } = state
    return (
      <CredentialsCard
        title="Сотрудник добавлен"
        description="Передайте эти данные сотруднику. Временный пароль показывается только сейчас — скопируйте его; при первом входе система попросит сменить пароль."
        login={account.login}
        temporaryPassword={account.temporaryPassword}
        rows={[
          { label: "Сотрудник", value: account.fullName },
          { label: "Роль", value: account.roleLabel },
          { label: "Отдел", value: account.department ?? "—" },
          { label: "Статус", value: "Ожидает первого входа" },
        ]}
        actions={
          <>
            <Button size="lg" variant="outline" onClick={onCreateAnother}>
              <UserPlus data-icon="inline-start" aria-hidden />
              Добавить ещё
            </Button>
            <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
              К сотрудникам
            </Link>
          </>
        }
      />
    )
  }

  if (state.status === "requested") {
    return (
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Заявка отправлена директору</h2>
        <p className="text-meta text-muted-foreground">
          {state.request.fullName} · {state.request.roleLabel} · отдел «{state.request.department}». Аккаунт появится, когда директор одобрит заявку; данные для
          входа он увидит при одобрении и передаст сотруднику.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" onClick={onCreateAnother}>
            <Send data-icon="inline-start" aria-hidden />
            Ещё одна заявка
          </Button>
          <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
            К сотрудникам и заявкам
          </Link>
        </div>
      </section>
    )
  }

  const errors = state.status === "error" ? state.fieldErrors : {}
  const values = state.status === "error" ? state.values : null

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-meta">
        Добавить сотрудника
        {options.fixedDepartment && <> · отдел «{options.fixedDepartment.name}»</>}.{" "}
        {isRequest ? "Аккаунт создаст директор, когда одобрит заявку." : "Роли доступны по вашим правам; сервер проверит их ещё раз."}
      </p>

      <Field id="fullName" label="Имя и фамилия" error={errors.fullName}>
        <Input id="fullName" name="fullName" defaultValue={values?.fullName} autoComplete="off" autoFocus aria-invalid={Boolean(errors.fullName)} className="h-10" />
      </Field>

      {options.roles.length > 0 && (
        <Field id="role" label="Роль" error={errors.role}>
          <input type="hidden" name="role" value={role ?? ""} />
          {options.roles.length === 1 ? (
            <p className="text-sm font-medium">{ROLE_LABELS[options.roles[0]]}</p>
          ) : (
            <Select items={options.roles.map((item) => ({ value: item, label: ROLE_LABELS[item] }))} value={role} onValueChange={(next) => setRole(next as Role)}>
              <SelectTrigger id="role" className="h-10 w-full" aria-invalid={Boolean(errors.role)}>
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                {options.roles.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      )}

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
                <SelectItem key={department.id} value={department.id} disabled={headTaken(department.id)}>
                  {department.name}
                  {headTaken(department.id) && " — уже есть РОП"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(noFreeDepartment || (departmentId !== null && headTaken(departmentId))) && (
            <p className="text-xs text-warning">{DEPARTMENT_HAS_HEAD_MESSAGE}</p>
          )}
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
          {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : isRequest ? <Send data-icon="inline-start" aria-hidden /> : <UserPlus data-icon="inline-start" aria-hidden />}
          {isRequest ? "Отправить заявку директору" : "Создать аккаунт"}
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
