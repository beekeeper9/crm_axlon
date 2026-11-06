"use client"

import { LoaderCircle, Sparkles } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"

/** Заголовок блока ИИ: что это, когда сделано и пометка тестового режима платформы */
export function AiHeading({ title, at, isMock }: { title: string; at: string | null; isMock: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" aria-hidden />
        {title}
      </p>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {isMock && <StatusBadge tone="warning">Тест, не ИИ</StatusBadge>}
        {at && formatDateTime(at)}
      </span>
    </div>
  )
}

export function AiRunButton({ label, isBusy, onClick }: { label: string; isBusy: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="xs" variant="outline" disabled={isBusy} onClick={onClick}>
      {isBusy ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Sparkles data-icon="inline-start" aria-hidden />}
      {isBusy ? "Готовлю…" : label}
    </Button>
  )
}

export function AiNotes({ failure, failed, isWaitingTooLong }: { failure: string | null; failed: boolean; isWaitingTooLong: boolean }) {
  return (
    <>
      {failed && !failure && <p className="text-meta text-muted-foreground">Не удалось подготовить, попробуйте позже.</p>}
      {isWaitingTooLong && <p className="text-meta text-muted-foreground">Модель отвечает дольше обычного. Результат придёт уведомлением.</p>}
      {failure && (
        <p role="alert" className="text-meta text-destructive">
          {failure}
        </p>
      )}
    </>
  )
}

export const AI_DISCLAIMER = "Создано ИИ, проверьте."
