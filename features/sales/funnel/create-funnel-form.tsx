"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createFunnelAction } from "@/features/sales/funnel/funnel-actions"
import type { NewFunnelStage } from "@/features/sales/funnel/funnel-api"
import { FUNNEL_TEMPLATE } from "@/features/sales/funnel/funnel-rules"

type Source = "template" | "company"

/**
 * Новая воронка отдела. Этапы берутся из шаблона или копируются из воронки компании —
 * дальше РОП меняет их как угодно. РОПу backend сам ставит его отдел; директор выбирает отдел.
 */
export function CreateFunnelForm({
  companyStages,
  departments,
  basePath,
}: {
  /** Этапы основной воронки компании (для копирования); пусто — копировать нечего */
  companyStages: readonly NewFunnelStage[]
  /** Только директору: для какого отдела воронка */
  departments: readonly { id: string; name: string }[] | null
  basePath: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [name, setName] = useState("Воронка отдела")
  const [source, setSource] = useState<Source>("template")
  const [departmentId, setDepartmentId] = useState<string | null>(departments?.[0]?.id ?? null)
  const sources = [
    { value: "template", label: "Шаблон: 8 этапов" },
    ...(companyStages.length > 0 ? [{ value: "company", label: "Копия воронки компании" }] : []),
  ]
  const stages = source === "company" ? companyStages : FUNNEL_TEMPLATE

  return (
    <form
      className="grid gap-4 rounded-xl p-4 ring-1 ring-border"
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(async () => {
          const result = await createFunnelAction({ name, stages: [...stages], departmentId: departments ? departmentId : null })
          if (result.ok) {
            setFailure(null)
            router.push(`${basePath}?pipeline=${encodeURIComponent(result.data)}`)
            router.refresh()
          } else setFailure(result.message)
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="funnel-name">Название</Label>
          <Input id="funnel-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="h-8" />
        </div>
        {departments && (
          <div className="grid gap-1.5">
            <Label htmlFor="funnel-department">Отдел</Label>
            <Select items={departments.map((item) => ({ value: item.id, label: item.name }))} value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger id="funnel-department" className="h-8 w-full">
                <SelectValue placeholder="Выберите отдел" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="funnel-source">Начать с</Label>
          <Select items={sources} value={source} onValueChange={(value) => value && setSource(value as Source)}>
            <SelectTrigger id="funnel-source" className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-meta text-muted-foreground">Этапы: {stages.map((stage) => stage.name).join(" → ")}. После создания их можно переименовать, переставить и удалить. Сервер добавит системный этап «Встреча перенесена», а «Продажа» всегда стоит последней: на неё сделку переводит подтверждённая оплата.</p>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <Button type="submit" size="sm" className="w-fit" disabled={isPending || (departments !== null && !departmentId)}>
        {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Plus data-icon="inline-start" aria-hidden />}
        Создать воронку
      </Button>
    </form>
  )
}
