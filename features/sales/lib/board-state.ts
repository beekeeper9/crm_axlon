import type { BoardColumn, Deal } from "@/features/sales/schemas"
import { addDecimals, subtractDecimal } from "@/lib/decimal"

/**
 * Локальный перенос сделки между колонками доски — только для демо-режима.
 * В реальном режиме новое состояние доски вернёт backend после смены этапа.
 */

function withoutDeal(column: BoardColumn, deal: Deal): BoardColumn {
  const total =
    deal.amount && column.totalAmount ? subtractDecimal(column.totalAmount, deal.amount) : column.totalAmount
  return {
    ...column,
    count: column.count - 1,
    totalAmount: total === "0.00" ? null : total,
    deals: column.deals.filter((item) => item.id !== deal.id),
  }
}

function withDeal(column: BoardColumn, deal: Deal): BoardColumn {
  return {
    ...column,
    count: column.count + 1,
    totalAmount: deal.amount ? addDecimals([column.totalAmount ?? "0", deal.amount]) : column.totalAmount,
    currency: column.currency ?? deal.currency,
    deals: [deal, ...column.deals],
  }
}

export function findDeal(columns: readonly BoardColumn[], dealId: string): Deal | undefined {
  for (const column of columns) {
    const deal = column.deals.find((item) => item.id === dealId)
    if (deal) return deal
  }
  return undefined
}

/** Переносит сделку на этап. Если этапа нет среди колонок (закрытие), сделка уходит с доски. */
export function moveDeal(columns: readonly BoardColumn[], dealId: string, stageId: string): BoardColumn[] {
  const deal = findDeal(columns, dealId)
  if (!deal || deal.stageId === stageId) return [...columns]
  const moved: Deal = { ...deal, stageId }

  return columns.map((column) => {
    if (column.stageId === deal.stageId) return withoutDeal(column, deal)
    if (column.stageId === stageId) return withDeal(column, moved)
    return column
  })
}
