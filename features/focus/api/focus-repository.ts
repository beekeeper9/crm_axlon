import { isMockDataSource } from "@/config/env"
import { focusListSchema, type FocusList } from "@/features/focus/schemas"
import { contractPending } from "@/lib/api/errors"
import { filterDemoFocusList } from "@/mocks/focus"
import { simulateLatency } from "@/mocks/latency"
import { demoOwnScope } from "@/mocks/scope"

export type FocusQuery = {
  /** null — все доступные пользователю лиды (для руководителя — вся команда) */
  managerId: string | null
}

export type FocusRepository = {
  getFocusList(query: FocusQuery): Promise<FocusList>
}

const mockFocusRepository: FocusRepository = {
  async getFocusList({ managerId }) {
    await simulateLatency(400)
    const ownScope = await demoOwnScope()
    const list = filterDemoFocusList(ownScope ?? managerId)
    // Список коллег со счётчиками нужен только руководителю
    return focusListSchema.parse(ownScope ? { ...list, managers: [] } : list)
  },
}

/** Endpoint не согласован — см. docs/API_CONTRACT.md, раздел «Фокус». */
const httpFocusRepository: FocusRepository = {
  async getFocusList() {
    return contractPending("список «Фокус»")
  },
}

export const focusRepository: FocusRepository = isMockDataSource
  ? mockFocusRepository
  : httpFocusRepository
