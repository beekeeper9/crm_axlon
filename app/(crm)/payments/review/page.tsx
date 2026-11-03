import { Suspense } from "react"
import type { Metadata } from "next"

import { ReceiptText } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { PaymentReviewView } from "@/features/payments/components/payment-review-view"
import { getCurrentUser } from "@/lib/session/current-user"

export const metadata: Metadata = { title: "Проверка оплат" }

/** Проверяют оплаты РОП (свой отдел) и директор; кому что показать — решает backend */
async function ReviewContent() {
  const user = await getCurrentUser()
  if (user.role !== "director" && user.role !== "head_of_sales") {
    return <p className="text-sm text-muted-foreground">Оплаты проверяет руководитель отдела продаж или директор.</p>
  }
  return <PaymentReviewView />
}

export default function PaymentReviewPage() {
  if (isMockDataSource) {
    return <EmptyState icon={ReceiptText} title="Проверка оплат" description="Оплаты и чеки хранятся на backend — в демо-режиме их нет." />
  }
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Проверка оплат" description="Сверьте сумму с чеком и подтвердите оплату — только тогда сделка станет продажей." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <ReviewContent />
      </Suspense>
    </div>
  )
}
