"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, LoaderCircle, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  setErrorStatusAction,
  setSubscriptionAction,
  updateCompanyAction,
  updateTicketAction,
  type ActionResult,
} from "@/features/platform/actions"
import { ERROR_STATUS_META, FEATURE_LABELS, PLAN_LABELS, SUBSCRIPTION_STATUS_LABELS, TICKET_STATUS_META } from "@/features/platform/labels"
import {
  ERROR_STATUSES,
  FEATURES,
  PLAN_CODES,
  SUBSCRIPTION_STATUSES,
  TICKET_STATUSES,
  type Catalog,
  type ErrorStatus,
  type Feature,
  type PlanCode,
  type Subscription,
  type SubscriptionStatus,
  type TicketStatus,
} from "@/features/platform/schemas"

type Failure = Extract<ActionResult, { ok: false }>

export function ActionError({ failure }: { failure: Failure | null }) {
  if (!failure) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      <span>
        {failure.message}
        {failure.requestId && <span className="block text-xs text-muted-foreground">Код запроса: {failure.requestId}</span>}
      </span>
    </p>
  )
}

export function FormField({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Выбор из списка с подписями; значение уходит в состояние формы */
export function ChoiceSelect<T extends string>({ id, value, options, onChange, invalid }: { id: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; invalid?: boolean }) {
  return (
    <Select items={options.map((o) => ({ value: o.value, label: o.label }))} value={value} onValueChange={(next) => next && onChange(next as T)}>
      <SelectTrigger id={id} className="h-10 w-full" aria-invalid={invalid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function FeatureChecklist({ value, onChange }: { value: readonly Feature[]; onChange: (next: Feature[]) => void }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Модули</legend>
      {FEATURES.map((feature) => (
        <label key={feature} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ring-border has-checked:bg-primary/5 has-checked:ring-primary/40">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={value.includes(feature)}
            onChange={(event) => onChange(event.target.checked ? [...value, feature] : value.filter((item) => item !== feature))}
          />
          {FEATURE_LABELS[feature]}
        </label>
      ))}
    </fieldset>
  )
}

export function planOptions(catalog: Catalog) {
  return PLAN_CODES.map((code) => {
    const plan = catalog.plans.find((item) => item.code === code)
    return { value: code, label: plan ? `${PLAN_LABELS[code]} · ${plan.monthlyPrice} ${plan.currency}/мес.` : PLAN_LABELS[code] }
  })
}

export function defaultFeatures(catalog: Catalog, plan: PlanCode): Feature[] {
  return [...(catalog.plans.find((item) => item.code === plan)?.features ?? [])]
}

/** Тариф, срок, статус и модули компании. Назначение — не подтверждение оплаты */
export function SubscriptionForm({ companyId, subscription, catalog, today }: { companyId: string; subscription: Subscription | null; catalog: Catalog; today: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [planCode, setPlanCode] = useState<PlanCode>(subscription?.planCode ?? "pro")
  const [startsOn, setStartsOn] = useState(subscription?.startsOn ?? today)
  const [endsOn, setEndsOn] = useState(subscription?.endsOn ?? "")
  const [status, setStatus] = useState<SubscriptionStatus>(subscription?.status ?? "active")
  const [features, setFeatures] = useState<Feature[]>(subscription?.features ?? defaultFeatures(catalog, planCode))
  const [result, setResult] = useState<ActionResult | null>(null)
  const failure = result && !result.ok ? result : null

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const next = await setSubscriptionAction(companyId, { planCode, startsOn, endsOn, features, status })
      setResult(next)
      if (next.ok) router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {subscription?.features === null && (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-meta">Сейчас модули не ограничены (подписка создана до каталога модулей). После сохранения будут доступны только отмеченные.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="planCode" label="Тариф">
          <ChoiceSelect
            id="planCode"
            value={planCode}
            options={planOptions(catalog)}
            onChange={(next) => {
              setPlanCode(next)
              setFeatures(defaultFeatures(catalog, next))
            }}
          />
        </FormField>
        <FormField id="status" label="Статус подписки">
          <ChoiceSelect id="status" value={status} options={SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_LABELS[s] }))} onChange={setStatus} />
        </FormField>
        <FormField id="startsOn" label="Начало" error={failure?.fieldErrors.startsOn}>
          <Input id="startsOn" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="h-10" />
        </FormField>
        <FormField id="endsOn" label="Последний день доступа" error={failure?.fieldErrors.endsOn} hint={planCode === "trial" ? "Пусто — 7 дней с начала" : "Пусто — бессрочно"}>
          <Input id="endsOn" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="h-10" />
        </FormField>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Модули</p>
        <FeatureChecklist value={features} onChange={setFeatures} />
        <p className="text-xs text-muted-foreground">Основа CRM — клиенты, сделки, задачи, встречи, сотрудники и планы — входит в любой тариф. При смене тарифа отметки сбрасываются к его набору.</p>
      </div>
      <ActionError failure={failure} />
      {result?.ok && <p className="text-sm text-success">Подписка сохранена. Ограничения действуют для компании сразу.</p>}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Save data-icon="inline-start" aria-hidden />}
        Сохранить подписку
      </Button>
    </form>
  )
}

export function CompanyNameForm({ companyId, name }: { companyId: string; name: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(name)
  const [result, setResult] = useState<ActionResult | null>(null)
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const next = await updateCompanyAction(companyId, { name: value })
          setResult(next)
          if (next.ok) router.refresh()
        })
      }}
    >
      <div className="grid min-w-64 flex-1 gap-1.5">
        <Label htmlFor="companyName">Название</Label>
        <Input id="companyName" value={value} onChange={(e) => setValue(e.target.value)} className="h-10" />
      </div>
      <Button type="submit" variant="outline" size="lg" disabled={isPending || value.trim() === name}>
        Сохранить
      </Button>
      <div className="basis-full">
        <ActionError failure={result && !result.ok ? result : null} />
      </div>
    </form>
  )
}

/** Приостановить или возобновить доступ компании (с подтверждением) */
export function CompanyActiveControl({ companyId, isActive, name }: { companyId: string; isActive: boolean; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<Failure | null>(null)

  function confirm() {
    startTransition(async () => {
      const next = await updateCompanyAction(companyId, { isActive: !isActive })
      if (next.ok) {
        setOpen(false)
        router.refresh()
      } else setFailure(next)
    })
  }

  return (
    <>
      <Button variant={isActive ? "destructive" : "default"} size="lg" onClick={() => setOpen(true)}>
        {isActive ? "Приостановить доступ" : "Возобновить доступ"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isActive ? "Приостановить доступ компании?" : "Возобновить доступ компании?"}</DialogTitle>
            <DialogDescription>
              {isActive
                ? `Сотрудники «${name}» не смогут работать в CRM, пока доступ не возобновят. Данные сохранятся.`
                : `Сотрудники «${name}» снова смогут войти и работать.`}
            </DialogDescription>
          </DialogHeader>
          <ActionError failure={failure} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button variant={isActive ? "destructive" : "default"} onClick={confirm} disabled={isPending}>
              {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              {isActive ? "Приостановить" : "Возобновить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ErrorStatusControl({ errorId, status }: { errorId: string; status: ErrorStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<Failure | null>(null)
  return (
    <div className="flex items-center gap-2">
      <div className="w-36">
        <ChoiceSelect
          id={`error-${errorId}`}
          value={status}
          options={ERROR_STATUSES.map((s) => ({ value: s, label: ERROR_STATUS_META[s].label }))}
          onChange={(next) =>
            startTransition(async () => {
              const result = await setErrorStatusAction(errorId, next)
              setFailure(result.ok ? null : result)
              if (result.ok) router.refresh()
            })
          }
        />
      </div>
      {isPending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Сохраняется" />}
      {failure && <span className="text-xs text-destructive">{failure.message}</span>}
    </div>
  )
}

export function TicketUpdateForm({ ticketId, status, internalNote }: { ticketId: string; status: TicketStatus; internalNote: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nextStatus, setNextStatus] = useState<TicketStatus>(status)
  const [note, setNote] = useState(internalNote)
  const [result, setResult] = useState<ActionResult | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const next = await updateTicketAction(ticketId, { status: nextStatus, internalNote: note })
          setResult(next)
          if (next.ok) router.refresh()
        })
      }}
    >
      <FormField id="ticketStatus" label="Статус обработки">
        <ChoiceSelect id="ticketStatus" value={nextStatus} options={TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_META[s].label }))} onChange={setNextStatus} />
      </FormField>
      <FormField id="internalNote" label="Внутренний комментарий" hint="Видит только администратор платформы" error={result && !result.ok ? result.fieldErrors.internalNote : undefined}>
        <Textarea id="internalNote" value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={5000} />
      </FormField>
      <ActionError failure={result && !result.ok ? result : null} />
      {result?.ok && <p className="text-sm text-success">Сохранено.</p>}
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Save data-icon="inline-start" aria-hidden />}
        Сохранить
      </Button>
    </form>
  )
}
