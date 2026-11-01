"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, LoaderCircle, Undo2, X } from "lucide-react"

import { CredentialsCard } from "@/components/shared/credentials-card"
import { ListPanel } from "@/components/shared/list-panel"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { approveStaffRequest, cancelStaffRequest, rejectStaffRequest, type RequestActionResult } from "@/features/staff/actions"
import type { ApprovedRequest, StaffRequest } from "@/features/staff/schemas"
import { formatDateTime } from "@/lib/format"
import { ROLE_LABELS } from "@/lib/permissions/roles"

const STATUS_META: Record<StaffRequest["status"], { label: string; tone: StatusTone }> = {
  pending: { label: "Ждёт решения директора", tone: "warning" },
  approved: { label: "Одобрена", tone: "success" },
  rejected: { label: "Отклонена", tone: "danger" },
  cancelled: { label: "Отозвана", tone: "neutral" },
}

type StaffRequestsProps = {
  requests: readonly StaffRequest[]
  /** Директор решает; РОП видит заявки своего отдела и может отозвать свою */
  canDecide: boolean
  currentUserId: string
}

/** Заявки на найм и увольнение: РОП просит, директор решает */
export function StaffRequests({ requests, canDecide, currentUserId }: StaffRequestsProps) {
  const [approved, setApproved] = useState<ApprovedRequest | null>(null)
  if (requests.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Заявки на найм и увольнение</h2>
      <ListPanel>
        <ul className="divide-y">
          {requests.map((request) => (
            <RequestRow key={request.id} request={request} canDecide={canDecide} isMine={request.requestedBy.id === currentUserId} onApproved={setApproved} />
          ))}
        </ul>
      </ListPanel>
      <Dialog open={approved !== null && approved.temporaryPassword !== null} onOpenChange={(open) => !open && setApproved(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Данные нового сотрудника</DialogTitle>
          </DialogHeader>
          {approved?.temporaryPassword && (
            <CredentialsCard
              title="Заявка одобрена, аккаунт создан"
              description="Передайте данные сотруднику или его руководителю. Пароль показывается только сейчас."
              login={approved.login ?? "—"}
              temporaryPassword={approved.temporaryPassword}
              rows={[
                { label: "Сотрудник", value: approved.request.candidate?.fullName ?? "—" },
                { label: "Роль", value: `${approved.request.candidate ? ROLE_LABELS[approved.request.candidate.role] : ""} · ${approved.request.department.name}` },
              ]}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function RequestRow({
  request,
  canDecide,
  isMine,
  onApproved,
}: {
  request: StaffRequest
  canDecide: boolean
  isMine: boolean
  onApproved: (approved: ApprovedRequest) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState("")
  const meta = STATUS_META[request.status]
  const pending = request.status === "pending"

  function act(operation: () => Promise<RequestActionResult<unknown>>, after?: (data: unknown) => void) {
    startTransition(async () => {
      const result = await operation()
      if (result.ok) {
        setFailure(null)
        setRejecting(false)
        after?.(result.data)
        router.refresh()
      } else setFailure(result.requestId ? `${result.message} (код запроса ${result.requestId})` : result.message)
    })
  }

  const subject =
    request.kind === "hire"
      ? `Нанять: ${request.candidate?.fullName ?? "—"}${request.candidate ? ` · ${ROLE_LABELS[request.candidate.role]}` : ""}`
      : `Уволить: ${request.target?.name ?? "—"}`

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">{subject}</p>
        <p className="text-meta text-muted-foreground">
          Отдел «{request.department.name}» · {request.requestedBy.name} · {formatDateTime(request.createdAt)}
          {request.reason && ` · ${request.reason}`}
        </p>
        {request.decidedBy && (
          <p className="text-xs text-muted-foreground">
            Решение: {request.decidedBy}
            {request.decisionNote && ` — ${request.decisionNote}`}
          </p>
        )}
        {failure && <p className="text-xs text-destructive">{failure}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        {isPending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Выполняется" />}
        {pending && canDecide && (
          <>
            <Button size="sm" disabled={isPending} onClick={() => act(() => approveStaffRequest(request.id), (data) => onApproved(data as ApprovedRequest))}>
              <Check data-icon="inline-start" aria-hidden />
              Одобрить
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => setRejecting(true)}>
              <X data-icon="inline-start" aria-hidden />
              Отклонить
            </Button>
          </>
        )}
        {pending && !canDecide && isMine && (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => act(() => cancelStaffRequest(request.id))}>
            <Undo2 data-icon="inline-start" aria-hidden />
            Отозвать
          </Button>
        )}
      </div>
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отклонить заявку?</DialogTitle>
            <DialogDescription>{subject}</DialogDescription>
          </DialogHeader>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Причина (увидит автор заявки)" aria-label="Причина отказа" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={() => act(() => rejectStaffRequest(request.id, note))}>
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
