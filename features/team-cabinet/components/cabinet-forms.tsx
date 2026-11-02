"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createAbsenceAction, setPlanAction, type CabinetActionResult } from "@/features/team-cabinet/actions"
import {
  ABSENCE_KINDS,
  ABSENCE_LABELS,
  MONTHLY_METRICS,
  PLAN_METRIC_LABELS,
  type AbsenceKind,
  type PlanMetric,
} from "@/features/team-cabinet/lib/plan-absence-meta"

type Option = { value: string; label: string }

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function Choice({ id, value, options, onChange }: { id: string; value: string | null; options: readonly Option[]; onChange: (value: string) => void }) {
  return (
    <Select items={options.map((option) => ({ ...option }))} value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Выберите" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Общая обёртка: кнопка раскрывает форму, сохранение — server action, после успеха — обновление страницы */
function useSave() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  function save(operation: () => Promise<CabinetActionResult>, onDone: () => void) {
    startTransition(async () => {
      const error = await operation()
      setFailure(error)
      if (!error) {
        onDone()
        router.refresh()
      }
    })
  }
  return { isPending, failure, save }
}

/**
 * Задать или изменить план. Какие уровни доступны, решает backend: план компании и отдела —
 * директор, план менеджера — ещё и РОП своего отдела.
 */
export function PlanForm({ members, departments, canCompany, period }: { members: readonly Option[]; departments: readonly Option[]; canCompany: boolean; period: string }) {
  const [open, setOpen] = useState(false)
  const scopes: Option[] = [
    { value: "user", label: "Сотрудник" },
    ...(departments.length > 0 ? [{ value: "department", label: "Отдел" }] : []),
    ...(canCompany ? [{ value: "company", label: "Компания" }] : []),
  ]
  const [scope, setScope] = useState("user")
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [metric, setMetric] = useState<PlanMetric>("monthly_sales")
  const [target, setTarget] = useState("")
  const [month, setMonth] = useState(period)
  const { isPending, failure, save } = useSave()

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        Задать план
      </Button>
    )
  }
  const targets = scope === "user" ? members : scope === "department" ? departments : []
  return (
    <form
      className="grid gap-3 rounded-xl p-4 ring-1 ring-border sm:grid-cols-2 lg:grid-cols-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save(
          () => setPlanAction({ scope: scope as "user" | "department" | "company", scopeId: scope === "company" ? null : scopeId, metric, period: month, target }),
          () => {
            setOpen(false)
            setTarget("")
          }
        )
      }}
    >
      <Field id="plan-scope" label="Уровень">
        <Choice id="plan-scope" value={scope} options={scopes} onChange={(value) => { setScope(value); setScopeId(null) }} />
      </Field>
      {scope !== "company" && (
        <Field id="plan-target-of" label={scope === "user" ? "Сотрудник" : "Отдел"}>
          <Choice id="plan-target-of" value={scopeId} options={targets} onChange={setScopeId} />
        </Field>
      )}
      <Field id="plan-metric" label="Показатель">
        <Choice id="plan-metric" value={metric} options={MONTHLY_METRICS.map((value) => ({ value, label: PLAN_METRIC_LABELS[value] }))} onChange={(value) => setMetric(value as PlanMetric)} />
      </Field>
      <Field id="plan-period" label="Месяц">
        <Input id="plan-period" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      <Field id="plan-value" label={metric === "monthly_sales" ? "Продаж, шт." : "Сумма"}>
        <Input id="plan-value" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" />
      </Field>
      {failure && (
        <p role="alert" className="text-sm text-destructive sm:col-span-full">
          {failure}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-full">
        <Button type="submit" size="sm" disabled={isPending || (scope !== "company" && !scopeId)}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Сохранить план
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  )
}

/** Запланированное отсутствие: на этот период нет сигнала «нет активности» */
export function AbsenceForm({ members }: { members: readonly Option[] }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [kind, setKind] = useState<AbsenceKind>("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [comment, setComment] = useState("")
  const { isPending, failure, save } = useSave()

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" aria-hidden />
        Отметить отсутствие
      </Button>
    )
  }
  return (
    <form
      className="grid gap-3 rounded-xl p-4 ring-1 ring-border sm:grid-cols-2 lg:grid-cols-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save(() => createAbsenceAction({ userId: userId ?? "", kind, startDate, endDate, comment }), () => setOpen(false))
      }}
    >
      <Field id="absence-user" label="Сотрудник">
        <Choice id="absence-user" value={userId} options={members} onChange={setUserId} />
      </Field>
      <Field id="absence-kind" label="Тип">
        <Choice id="absence-kind" value={kind} options={ABSENCE_KINDS.map((value) => ({ value, label: ABSENCE_LABELS[value] }))} onChange={(value) => setKind(value as AbsenceKind)} />
      </Field>
      <Field id="absence-start" label="С">
        <Input id="absence-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>
      <Field id="absence-end" label="По">
        <Input id="absence-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </Field>
      <Field id="absence-comment" label="Комментарий">
        <Input id="absence-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      </Field>
      {failure && (
        <p role="alert" className="text-sm text-destructive sm:col-span-full">
          {failure}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-full">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Сохранить
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  )
}
