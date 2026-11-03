import { z } from "zod"

/** Категории уведомлений backend и правило напоминаний; без серверных зависимостей — нужен и в браузере */
export const notificationCategorySchema = z.enum(["meeting", "deal", "lead", "payment", "system", "ai", "task", "report", "inactivity"])

export type NotificationCategory = z.infer<typeof notificationCategorySchema>

/** Сколько дней до срока задачи приходит напоминание: 0 — в день срока, не больше 7 (правило backend) */
export const MAX_REMINDER_DAYS_BEFORE = 7
