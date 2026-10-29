import { isMockDataSource } from "@/config/env"
import { afterMeetingQueueSchema, type AfterMeetingQueue } from "@/features/after-meeting/schemas"
import { contractPending } from "@/lib/api/errors"
import { demoAfterMeetingQueue } from "@/mocks/after-meeting"
import { simulateLatency } from "@/mocks/latency"
import { demoScopedManagerId } from "@/mocks/scope"

export type AfterMeetingRepository = {
  /** hostId — для руководителя; менеджеру backend сам ограничивает своими встречами */
  getQueue(query: { hostId: string | null }): Promise<AfterMeetingQueue>
}

const mockAfterMeetingRepository: AfterMeetingRepository = {
  async getQueue({ hostId }) {
    await simulateLatency(400)
    return afterMeetingQueueSchema.parse(demoAfterMeetingQueue(await demoScopedManagerId(hostId)))
  },
}

/** Endpoint не согласован — см. docs/API_CONTRACT.md, раздел «После встречи». */
const httpAfterMeetingRepository: AfterMeetingRepository = {
  async getQueue() {
    return contractPending("очередь «После встречи»")
  },
}

export const afterMeetingRepository: AfterMeetingRepository = isMockDataSource
  ? mockAfterMeetingRepository
  : httpAfterMeetingRepository
