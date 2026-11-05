"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { prospectRoute } from "@/config/routes"
import { disqualifyProspectAction, qualifyProspectAction } from "@/features/prospects/actions"
import { ConvertDialog, type ConvertOptions, type ConvertTarget } from "@/features/prospects/components/convert-dialog"
import { PROSPECT_SOURCE_LABELS, PROSPECT_STATUS_META } from "@/features/prospects/lib/prospect-meta"
import type { Prospect, ProspectStatus } from "@/features/prospects/schemas"
import { formatDayMonth, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ProspectColumn = { status: ProspectStatus; count: number; prospects: Prospect[] }

type ProspectsBoardProps = {
  columns: readonly ProspectColumn[]
  options: ConvertOptions
  showOwner: boolean
  canEdit: boolean
}

/** Откуда и куда лид можно перетащить: «Новый» и «Квалифицирован» — рабочие, остальные — итог */
function canMove(from: ProspectStatus, to: ProspectStatus): boolean {
  if (from === to) return false
  if (from === "new") return to !== "new"
  if (from === "qualified") return to === "unqualified" || to === "converted"
  return false
}

/**
 * Входящие лиды по статусам. Перетаскивание делает то же, что кнопки в карточке: квалифицирует,
 * отклоняет с причиной или переводит в клиенты (со сделкой, этапом и следующим шагом).
 * После каждого шага доска — снова ответ сервера.
 */
export function ProspectsBoard({ columns, options, showOwner, canEdit }: ProspectsBoardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dragged, setDragged] = useState<Prospect | null>(null)
  const [dropTarget, setDropTarget] = useState<ProspectStatus | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [disqualifying, setDisqualifying] = useState<Prospect | null>(null)
  const [converting, setConverting] = useState<ConvertTarget | null>(null)

  function drop(prospect: Prospect, to: ProspectStatus) {
    setFailure(null)
    if (!canMove(prospect.status, to)) {
      setFailure(
        prospect.status === "converted" || prospect.status === "unqualified"
          ? `«${prospect.name}» уже ${PROSPECT_STATUS_META[prospect.status].label.toLowerCase()} — этот лид больше не переносится.`
          : "Квалифицированный лид не возвращается в «Новые»."
      )
      return
    }
    if (to === "qualified") {
      startTransition(async () => {
        const result = await qualifyProspectAction(prospect.id)
        if (!result.ok) setFailure(result.message)
        router.refresh()
      })
    } else if (to === "unqualified") setDisqualifying(prospect)
    else if (to === "converted") setConverting({ id: prospect.id, name: prospect.name, needsQualification: prospect.status === "new", customerCandidates: [] })
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite">
        {isPending && <p className="text-meta text-muted-foreground">Сохраняем…</p>}
        {failure && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {failure}
          </p>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <ol className="flex min-w-max gap-2.5" aria-label="Входящие лиды по статусам">
          {columns.map((column) => {
            const meta = PROSPECT_STATUS_META[column.status]
            const isTarget = dropTarget === column.status && dragged !== null && canMove(dragged.status, column.status)
            return (
              <li
                key={column.status}
                className="flex w-[17rem] shrink-0 flex-col"
                onDragOver={(event) => {
                  if (!dragged || !canMove(dragged.status, column.status)) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                  setDropTarget(column.status)
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragged) drop(dragged, column.status)
                  setDragged(null)
                  setDropTarget(null)
                }}
              >
                <header className="mb-2 flex items-center justify-between gap-2 px-1">
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  <span className="text-meta text-muted-foreground tabular-nums">{formatNumber(column.count)}</span>
                </header>
                <ul
                  aria-label={`${meta.label}: ${formatNumber(column.count)}`}
                  className={cn(
                    "flex min-h-24 flex-1 flex-col gap-1.5 rounded-xl p-1 transition-colors md:max-h-[calc(100svh-15rem)] md:overflow-y-auto",
                    isTarget ? "bg-primary/10 ring-1 ring-primary/50 ring-inset" : "bg-muted/25"
                  )}
                >
                  {column.prospects.map((prospect) => {
                    const movable = canEdit && (prospect.status === "new" || prospect.status === "qualified")
                    return (
                      <li
                        key={prospect.id}
                        draggable={movable}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", prospect.id)
                          event.dataTransfer.effectAllowed = "move"
                          setDragged(prospect)
                        }}
                        onDragEnd={() => {
                          setDragged(null)
                          setDropTarget(null)
                        }}
                        className={cn(
                          "relative space-y-1 rounded-lg bg-card px-3 py-2.5 ring-1 ring-border transition-[box-shadow,opacity] hover:ring-foreground/20 focus-within:ring-ring/60",
                          movable && "cursor-grab active:cursor-grabbing",
                          dragged?.id === prospect.id && "opacity-40"
                        )}
                      >
                        <Link href={prospectRoute(prospect.id)} className="block font-medium after:absolute after:inset-0 focus-visible:outline-none">
                          {prospect.name}
                        </Link>
                        <p className="text-meta text-muted-foreground tabular-nums">{prospect.phone ?? prospect.email ?? "Контакты не указаны"}</p>
                        <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {PROSPECT_SOURCE_LABELS[prospect.source]} · {formatDayMonth(prospect.createdAt)}
                          </span>
                          {showOwner && <PersonAvatar name={prospect.owner.name} />}
                        </p>
                      </li>
                    )
                  })}
                  {column.prospects.length === 0 && (
                    <li className="flex flex-1 items-center justify-center px-3 py-6 text-center text-meta text-muted-foreground">Пусто</li>
                  )}
                  {column.count > column.prospects.length && (
                    <li className="px-2 py-1 text-center text-xs text-muted-foreground">
                      Показаны {formatNumber(column.prospects.length)} из {formatNumber(column.count)} — остальные в списке
                    </li>
                  )}
                </ul>
              </li>
            )
          })}
        </ol>
      </div>

      <DisqualifyDialog
        prospect={disqualifying}
        onClose={() => setDisqualifying(null)}
        onDone={() => {
          setDisqualifying(null)
          router.refresh()
        }}
      />
      <ConvertDialog
        target={converting}
        options={options}
        note="Совпадения с существующими клиентами видны в карточке лида — откройте её, если клиента нужно привязать."
        onClose={() => setConverting(null)}
        onConverted={() => {
          setConverting(null)
          router.refresh()
        }}
      />
    </div>
  )
}

function DisqualifyDialog({ prospect, onClose, onDone }: { prospect: Prospect | null; onClose: () => void; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState("")
  const [failure, setFailure] = useState<string | null>(null)
  return (
    <Dialog
      open={prospect !== null}
      onOpenChange={(open) => {
        if (open) return
        setReason("")
        setFailure(null)
        onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!prospect) return
            startTransition(async () => {
              const result = await disqualifyProspectAction(prospect.id, reason)
              if (!result.ok) {
                setFailure(result.message)
                return
              }
              setReason("")
              setFailure(null)
              onDone()
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>«{prospect?.name}» не подходит</DialogTitle>
            <DialogDescription>Причина останется в карточке лида.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="board-disqualify-reason">Почему не подходит</Label>
            <Textarea id="board-disqualify-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} autoFocus />
          </div>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Отмена
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              Отметить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
