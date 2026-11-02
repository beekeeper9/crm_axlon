"use client"

import { useEffect, useState } from "react"
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { reportStatusAction, requestKpiReportAction } from "@/features/team-cabinet/actions"
import type { ReportJob } from "@/features/team-cabinet/api/reports"

const POLL_MS = 2000

/**
 * Выгрузка KPI в CSV: backend формирует файл в фоне, страница опрашивает статус задачи
 * и показывает ссылку на скачивание. Что попадает в файл (без телефонов), решает backend.
 */
export function KpiExport({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [job, setJob] = useState<ReportJob | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const isWaiting = job !== null && (job.status === "queued" || job.status === "running")

  useEffect(() => {
    if (!job || !isWaiting) return
    const timer = setTimeout(async () => {
      const result = await reportStatusAction(job.id)
      if (result.ok) setJob(result.job)
      else setFailure(result.message)
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [job, isWaiting])

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileSpreadsheet data-icon="inline-start" aria-hidden />
        Выгрузить KPI
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Начало периода" className="h-8 w-auto" />
      <span>—</span>
      <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Конец периода" className="h-8 w-auto" />
      <Button
        size="sm"
        disabled={isRequesting || isWaiting}
        onClick={async () => {
          setIsRequesting(true)
          setFailure(null)
          const result = await requestKpiReportAction(start, end, crypto.randomUUID())
          setIsRequesting(false)
          if (result.ok) setJob(result.job)
          else setFailure(result.message)
        }}
      >
        {(isRequesting || isWaiting) && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
        {isWaiting ? "Формируется…" : "Сформировать CSV"}
      </Button>
      {job?.status === "succeeded" && (
        <a href={`/exports/${encodeURIComponent(job.id)}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
          <Download data-icon="inline-start" aria-hidden />
          Скачать
        </a>
      )}
      {job?.status === "failed" && <span className="text-destructive">Не удалось сформировать: {job.error ?? "ошибка на сервере"}</span>}
      {failure && (
        <span role="alert" className="text-destructive">
          {failure}
        </span>
      )}
    </div>
  )
}
