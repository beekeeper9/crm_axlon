import { DEMO_NOW } from "@/config/demo-clock"
import { isMockDataSource } from "@/config/env"

/** Текущий момент для подписей («сегодня», «данные на»): в демо — фиксированная дата демо-данных */
export function nowIso(): string {
  return isMockDataSource ? DEMO_NOW : new Date().toISOString()
}
