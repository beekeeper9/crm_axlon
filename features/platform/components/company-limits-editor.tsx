"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, RotateCcw, Save } from "lucide-react"

import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { METRIC_LABELS, UNLIMITED, type MetricUsage } from "@/features/plan-limits/schemas"
import { setCompanyLimitsAction, type ActionResult } from "@/features/platform/actions"
import { ActionError } from "@/features/platform/components/platform-controls"
import { limitRows, limitsPayload, type LimitRow } from "@/features/platform/limits-form"
import { formatNumber } from "@/lib/format"

const STATE_META: Record<MetricUsage["state"], { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "В пределах" },
  warning: { tone: "warning", label: "Больше 80%" },
  reached: { tone: "danger", label: "Исчерпан" },
}

function limitText(limit: number): string {
  return limit === UNLIMITED ? "без лимита" : formatNumber(limit)
}

/**
 * Лимиты компании: сколько использовано и сколько разрешено. Значение берётся из тарифа,
 * пока администратор не задал своё; «Вернуть тариф» снимает все изменения сразу.
 */
export function CompanyLimitsEditor({ companyId, metrics }: { companyId: string; metrics: readonly MetricUsage[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<LimitRow[]>(() => limitRows(metrics))
  const [result, setResult] = useState<ActionResult | null>(null)
  const anyOverridden = metrics.some((metric) => metric.overridden)

  function patch(index: number, change: Partial<LimitRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)))
    setResult(null)
  }

  function save(limits: ReturnType<typeof limitsPayload>) {
    if (!limits) {
      setResult({ ok: false, message: "Лимит — целое число от 0 или «без лимита».", fieldErrors: {}, requestId: null })
      return
    }
    startTransition(async () => {
      const next = await setCompanyLimitsAction(companyId, limits)
      setResult(next)
      if (next.ok) router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg ring-1 ring-border">
        {metrics.map((metric, index) => {
          const row = rows[index]
          const inputId = `limit-${metric.metric}`
          return (
            <li key={metric.metric} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm">
              <div className="min-w-40 flex-1 space-y-0.5">
                <p className="font-medium">{METRIC_LABELS[metric.metric]}</p>
                <p className="text-meta text-muted-foreground">
                  {metric.used === null ? "использование неизвестно" : `${formatNumber(metric.used)} из ${limitText(metric.limit)}`}
                  {" · "}
                  {metric.overridden ? "изменено платформой" : "из тарифа"}
                </p>
              </div>
              {metric.used !== null && metric.limit !== UNLIMITED && (
                <StatusBadge tone={STATE_META[metric.state].tone}>{STATE_META[metric.state].label}</StatusBadge>
              )}
              {row.custom ? (
                <div className="flex items-center gap-2">
                  <label htmlFor={inputId} className="sr-only">
                    Лимит: {METRIC_LABELS[metric.metric]}
                  </label>
                  <Input
                    id={inputId}
                    inputMode="numeric"
                    value={row.value}
                    disabled={row.unlimited}
                    placeholder={row.unlimited ? "∞" : "0"}
                    onChange={(event) => patch(index, { value: event.target.value })}
                    className="h-8 w-24 tabular-nums"
                  />
                  <label className="flex items-center gap-1.5 text-meta">
                    <input
                      type="checkbox"
                      checked={row.unlimited}
                      onChange={(event) => patch(index, { unlimited: event.target.checked })}
                      className="size-4 accent-primary"
                    />
                    без лимита
                  </label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => patch(index, { ...limitRows([metric])[0], custom: false })}>
                    Из тарифа
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => patch(index, { custom: true })}>
                  Изменить
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <ActionError failure={result && !result.ok ? result : null} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isPending} onClick={() => save(limitsPayload(rows))}>
          {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Save data-icon="inline-start" aria-hidden />}
          Сохранить лимиты
        </Button>
        {anyOverridden && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => save({})}>
            <RotateCcw data-icon="inline-start" aria-hidden />
            Вернуть тариф
          </Button>
        )}
      </div>
    </div>
  )
}
