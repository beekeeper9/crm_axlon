/**
 * ДЕМО-ДАННЫЕ: вымышленный отдел продаж и «текущий момент» демо-режима.
 * Все демо-наборы (Фокус, Продажи, Задачи, Встречи) ссылаются на этих людей,
 * чтобы связи между разделами были правдоподобными.
 */

import { DEMO_TODAY } from "@/config/demo-clock"

export const demoManagers = [
  { id: "m-1", name: "Айбек Садыков" },
  { id: "m-2", name: "Нурлан Абдыкадыров" },
  { id: "m-3", name: "Мария Орлова" },
  { id: "m-4", name: "Бакыт Токтогулов" },
  { id: "m-5", name: "Динара Асанова" },
  { id: "m-6", name: "Тимур Ли" },
] as const

export type DemoPerson = { id: string; name: string }

export const demoHeadOfSales: DemoPerson = { id: "u-rop", name: "Алина Ким" }

/**
 * «Сейчас» в демо-режиме. Просрочку, группы сроков и периоды в реальном режиме
 * считает backend; в демо их считает mock-слой относительно этой даты.
 */
export { DEMO_NOW, DEMO_TODAY } from "@/config/demo-clock"

/** Дата YYYY-MM-DD со сдвигом от демо-сегодня */
export function demoDate(offsetDays: number): string {
  const date = new Date(`${DEMO_TODAY}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

/** Дата-время ISO (часовой пояс Бишкека) со сдвигом в днях от демо-сегодня */
export function demoAt(offsetDays: number, time: string): string {
  return `${demoDate(offsetDays)}T${time}:00+06:00`
}
