import { isMockDataSource } from "@/config/env"
import { myMonthSchema, todayActionsSchema, type MyMonth, type TodayActions } from "@/features/my-day/schemas"
import { contractPending } from "@/lib/api/errors"
import { getCurrentUser } from "@/lib/session/current-user"
import { simulateLatency } from "@/mocks/latency"
import { demoMyMonth, demoTodayActionsFor } from "@/mocks/my-day"
import { demoRequirePermission } from "@/mocks/scope"

/** Личные данные: backend определяет сотрудника по токену, параметр «чей» не передаётся */
export type MyDayRepository = {
  /** Показатели месяца YYYY-MM; null — данных за месяц нет */
  getMonth(month: string): Promise<MyMonth | null>
  getTodayActions(): Promise<TodayActions>
}

const mockMyDayRepository: MyDayRepository = {
  async getMonth(month) {
    await simulateLatency(400)
    await demoRequirePermission("my_day.view")
    const user = await getCurrentUser()
    const data = demoMyMonth(month, user.id)
    return data ? myMonthSchema.parse(data) : null
  },
  async getTodayActions() {
    await simulateLatency(450)
    const user = await getCurrentUser()
    return todayActionsSchema.parse(demoTodayActionsFor(user.id))
  },
}

/** Endpoint не согласованы — см. docs/API_CONTRACT.md, раздел «Мой день». */
const httpMyDayRepository: MyDayRepository = {
  async getMonth() {
    return contractPending("показатели месяца «Мой день»")
  },
  async getTodayActions() {
    return contractPending("дела на сегодня")
  },
}

export const myDayRepository: MyDayRepository = isMockDataSource ? mockMyDayRepository : httpMyDayRepository
