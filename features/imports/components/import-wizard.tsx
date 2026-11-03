"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { FileUp, LoaderCircle, RotateCcw, Upload } from "lucide-react"

import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { routes } from "@/config/routes"
import { commitImportAction, previewImportAction } from "@/features/imports/actions"
import { decodeCsv, isCsvFile, MAX_IMPORT_FILE_BYTES } from "@/features/imports/lib/decode-csv"
import { IMPORT_ENTITIES, IMPORT_ENTITY_LABELS, type ImportEntity, type ImportJob, type ImportPreview, type ImportRowStatus } from "@/features/imports/schemas"
import { formatNumber } from "@/lib/format"

export type ImportOwnerOption = { userId: string; name: string }

type ImportWizardProps = {
  /** Кому можно назначить новые записи (директор, РОП); null — только себе */
  owners: readonly ImportOwnerOption[] | null
}

const ROW_STATUS: Record<ImportRowStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Новая", tone: "success" },
  duplicate: { label: "Дубль", tone: "warning" },
  invalid: { label: "Ошибка", tone: "danger" },
}

/** Больше строк в таблице проверки не рисуем — итоги считаются по всему файлу */
const PREVIEW_ROWS_SHOWN = 300

type LoadedFile = { name: string; content: string }

/** Загрузка CSV: выбрать файл → проверка дублей на backend → подтвердить → итог */
export function ImportWizard({ owners }: ImportWizardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [entity, setEntity] = useState<ImportEntity>("leads")
  const [ownerUserId, setOwnerUserId] = useState<string>("")
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function check(next: LoadedFile, nextEntity: ImportEntity) {
    setPreview(null)
    setJob(null)
    setFailure(null)
    startTransition(async () => {
      const result = await previewImportAction({ entity: nextEntity, filename: next.name, content: next.content, ownerUserId: null })
      if (result.ok) setPreview(result.data)
      else setFailure(result.message)
    })
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    if (!isCsvFile(selected)) {
      setFailure("Нужен файл CSV. В Excel: «Файл → Сохранить как → CSV».")
      return
    }
    if (selected.size > MAX_IMPORT_FILE_BYTES) {
      setFailure("Файл больше 900 КБ. Разделите его на несколько частей.")
      return
    }
    const loaded = { name: selected.name, content: decodeCsv(await selected.arrayBuffer()) }
    setFile(loaded)
    check(loaded, entity)
  }

  function onEntityChange(next: ImportEntity) {
    setEntity(next)
    if (file) check(file, next)
  }

  function confirm() {
    if (!file) return
    setFailure(null)
    startTransition(async () => {
      const result = await commitImportAction({ entity, filename: file.name, content: file.content, ownerUserId: ownerUserId || null })
      if (result.ok) {
        setJob(result.data)
        setPreview(null)
      } else setFailure(result.message)
    })
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setJob(null)
    setFailure(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Что загружаем</legend>
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            {IMPORT_ENTITIES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={entity === value}
                disabled={isPending}
                onClick={() => onEntityChange(value)}
                className={
                  entity === value
                    ? "h-7 rounded-md bg-background px-3 text-sm font-medium shadow-sm"
                    : "h-7 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {IMPORT_ENTITY_LABELS[value]}
              </button>
            ))}
          </div>
        </fieldset>
        {owners && (
          <div className="space-y-1.5">
            <Label htmlFor="import-owner">Ответственный за новые записи</Label>
            <select
              id="import-owner"
              value={ownerUserId}
              disabled={isPending}
              onChange={(event) => setOwnerUserId(event.target.value)}
              className="h-8 min-w-56 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">Я</option>
              {owners.map((owner) => (
                <option key={owner.userId} value={owner.userId}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="import-file">Файл CSV</Label>
          <input
            ref={inputRef}
            id="import-file"
            type="file"
            accept=".csv,text/csv,.txt"
            disabled={isPending}
            onChange={onFileChange}
            className="block text-sm file:mr-3 file:h-8 file:rounded-lg file:border file:border-input file:bg-background file:px-3 file:text-sm file:font-medium"
          />
        </div>
      </div>
      <p className="text-meta text-muted-foreground">
        Первая строка — заголовки: «Имя», «Телефон», «E-mail»{entity === "leads" && ", «Источник»"}. Телефон — в международном формате (+996…).
        До 2000 строк. Дубли ищутся по телефону и e-mail среди клиентов{entity === "leads" && " и лидов"} компании. Формат XLSX пока не поддерживается.
      </p>

      {isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {preview ? "Загружаем…" : "Проверяем файл…"}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}

      {preview && file && <PreviewBlock preview={preview} filename={file.name} isPending={isPending} onConfirm={confirm} onReset={reset} />}
      {job && <ResultBlock job={job} onReset={reset} />}
    </Card>
  )
}

type PreviewBlockProps = {
  preview: ImportPreview
  filename: string
  isPending: boolean
  onConfirm: () => void
  onReset: () => void
}

function PreviewBlock({ preview, filename, isPending, onConfirm, onReset }: PreviewBlockProps) {
  const shown = preview.rows.slice(0, PREVIEW_ROWS_SHOWN)
  return (
    <section aria-label="Проверка файла" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{filename}</span>
        <span className="text-muted-foreground">строк: {formatNumber(preview.total)}</span>
        <StatusBadge tone="success">новых {formatNumber(preview.new)}</StatusBadge>
        <StatusBadge tone="warning">дублей {formatNumber(preview.duplicates)}</StatusBadge>
        <StatusBadge tone="danger">с ошибками {formatNumber(preview.invalid)}</StatusBadge>
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Строка</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Пояснение</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => (
              <TableRow key={row.line}>
                <TableCell className="tabular-nums text-muted-foreground">{row.line}</TableCell>
                <TableCell>{row.name || "—"}</TableCell>
                <TableCell className="tabular-nums">{row.phone ?? "—"}</TableCell>
                <TableCell>{row.email ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge tone={ROW_STATUS[row.status].tone}>{ROW_STATUS[row.status].label}</StatusBadge>
                </TableCell>
                <TableCell className="text-meta whitespace-normal text-muted-foreground">{row.reason ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {preview.rows.length > shown.length && (
        <p className="text-meta text-muted-foreground">
          Показаны первые {formatNumber(shown.length)} строк из {formatNumber(preview.rows.length)}; итоги выше — по всему файлу.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={isPending || preview.new === 0}>
          <Upload data-icon="inline-start" aria-hidden />
          Загрузить новых: {formatNumber(preview.new)}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isPending}>
          Выбрать другой файл
        </Button>
      </div>
      {preview.new === 0 && <p className="text-meta text-muted-foreground">Новых строк нет — загружать нечего.</p>}
    </section>
  )
}

function ResultBlock({ job, onReset }: { job: ImportJob; onReset: () => void }) {
  const listRoute = job.entity === "leads" ? routes.prospects : routes.clientBase
  return (
    <section aria-label="Итог загрузки" role="status" className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <FileUp className="size-4 text-success" aria-hidden />
        Создано: {formatNumber(job.created)} из {formatNumber(job.total)}
      </p>
      <ul className="text-meta space-y-0.5 text-muted-foreground">
        <li>Пропущено дублей: {formatNumber(job.duplicates)}</li>
        <li>Пропущено строк с ошибками: {formatNumber(job.invalid)}</li>
        {job.failed > 0 && <li className="text-destructive">Не создано из-за ошибки сервера: {formatNumber(job.failed)}</li>}
      </ul>
      {job.errors.length > 0 && (
        <details className="text-meta">
          <summary className="cursor-pointer">Что не загрузилось ({formatNumber(job.errors.length)})</summary>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {job.errors.map((error) => (
              <li key={`${error.line}-${error.message}`}>
                Строка {error.line}: {error.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href={listRoute} className={buttonVariants({ variant: "outline" })}>
          {job.entity === "leads" ? "Открыть входящие лиды" : "Открыть базу клиентов"}
        </Link>
        <Button variant="ghost" onClick={onReset}>
          <RotateCcw data-icon="inline-start" aria-hidden />
          Загрузить ещё файл
        </Button>
      </div>
    </section>
  )
}
