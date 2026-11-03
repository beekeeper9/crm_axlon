"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { adoptDealsAction } from "@/features/sales/funnel/funnel-actions"
import type { AdoptionPreview, FunnelStage } from "@/features/sales/funnel/funnel-api"
import { activeStages, suggestStageMap } from "@/features/sales/funnel/funnel-rules"
import { formatNumber, pluralize } from "@/lib/format"

type DealAdoptionProps = {
  pipelineId: string
  pipelineName: string
  targetStages: readonly FunnelStage[]
  preview: AdoptionPreview
}

const deals = (n: number) => `${formatNumber(n)} ${pluralize(n, ["сделка", "сделки", "сделок"])}`

/**
 * Открытые сделки менеджеров отдела, оставшиеся в общей воронке компании. Сами они не
 * переносятся: пользователь выбирает этап воронки отдела для каждого этапа и подтверждает.
 * Каждое перемещение записывается в историю этапов сделки.
 */
export function DealAdoption({ pipelineId, pipelineName, targetStages, preview }: DealAdoptionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<number | null>(null)
  const withDeals = preview.stages.filter((stage) => stage.openDeals > 0)
  const targets = activeStages(targetStages).filter((stage) => stage.kind === "open")
  const [map, setMap] = useState<Record<string, string>>(() => suggestStageMap(preview.stages, targetStages))
  const complete = withDeals.every((stage) => map[stage.stageId])
  const targetName = new Map(targets.map((stage) => [stage.id, stage.name]))
  const perTarget = new Map<string, number>()
  for (const stage of withDeals) {
    const to = map[stage.stageId]
    if (to) perTarget.set(to, (perTarget.get(to) ?? 0) + stage.openDeals)
  }

  if (result !== null) {
    return (
      <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
        Перенесено {deals(result)} в воронку «{pipelineName}». История этапов каждой сделки сохранена.
      </p>
    )
  }

  function confirm() {
    startTransition(async () => {
      const response = await adoptDealsAction(pipelineId, preview.fromPipelineId, map)
      if (response.ok) {
        setResult(response.data)
        setOpen(false)
        setFailure(null)
        router.refresh()
      } else setFailure(response.message)
    })
  }

  return (
    <section className="space-y-2 rounded-xl px-4 py-3 ring-1 ring-warning/40" aria-label="Сделки отдела в общей воронке">
      <p className="text-sm">
        В общей воронке «{preview.fromPipelineName}» — {deals(preview.total)} менеджеров отдела в работе. Автоматически они
        не переносятся.
      </p>
      <Button size="sm" onClick={() => setOpen(true)} disabled={targets.length === 0}>
        Перенести в воронку отдела
      </Button>
      {targets.length === 0 && <p className="text-meta text-muted-foreground">Сначала добавьте в воронку отдела рабочий этап.</p>}

      <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Перенос сделок в «{pipelineName}»</DialogTitle>
            <DialogDescription>
              Для каждого этапа общей воронки выберите этап воронки отдела. Переносятся только открытые сделки менеджеров
              отдела; закрытые и чужие сделки остаются на месте.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {withDeals.map((stage) => (
              <li key={stage.stageId} className="grid gap-1.5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
                <Label htmlFor={`adopt-${stage.stageId}`} className="font-normal">
                  {stage.name} <span className="text-muted-foreground">· {deals(stage.openDeals)}</span>
                </Label>
                <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                <Select
                  items={targets.map((target) => ({ value: target.id, label: target.name }))}
                  value={map[stage.stageId] ?? null}
                  onValueChange={(value) => value && setMap((current) => ({ ...current, [stage.stageId]: value }))}
                >
                  <SelectTrigger id={`adopt-${stage.stageId}`} className="w-full">
                    <SelectValue placeholder="Выберите этап" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
          {perTarget.size > 0 && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-meta">
              <p className="font-medium">Будет перенесено:</p>
              <ul>
                {[...perTarget].map(([stageId, count]) => (
                  <li key={stageId}>
                    «{targetName.get(stageId)}» — {deals(count)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Отмена
            </Button>
            <Button onClick={confirm} disabled={!complete || isPending}>
              {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              Подтвердить перенос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
