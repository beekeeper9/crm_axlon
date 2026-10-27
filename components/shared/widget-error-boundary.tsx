"use client"

import { catchError, type ErrorInfo } from "next/error"
import { RotateCw } from "lucide-react"

import { ErrorState } from "@/components/shared/error-state"
import { WidgetCard } from "@/components/shared/widget-card"
import { Button } from "@/components/ui/button"

type WidgetErrorFallbackProps = {
  title: string
}

/**
 * Ошибка одного виджета не ломает всю страницу: показываем её внутри рамки виджета.
 * Подробности ошибки пользователю не показываем — в production Next.js их скрывает.
 */
function WidgetErrorFallback({ title }: WidgetErrorFallbackProps, { retry }: ErrorInfo) {
  return (
    <WidgetCard title={title}>
      <ErrorState
        action={
          <Button variant="outline" size="sm" onClick={() => retry()}>
            <RotateCw data-icon="inline-start" aria-hidden />
            Повторить
          </Button>
        }
      />
    </WidgetCard>
  )
}

export const WidgetErrorBoundary = catchError(WidgetErrorFallback)
