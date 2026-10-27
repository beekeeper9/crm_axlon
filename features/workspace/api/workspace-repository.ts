import { isMockDataSource } from "@/config/env"
import { defaultDashboardLayouts } from "@/features/workspace/default-layouts"
import type { WorkspaceLayout } from "@/features/workspace/schemas"
import { contractPending } from "@/lib/api/errors"
import type { Role } from "@/lib/permissions/roles"

export type WorkspaceRepository = {
  /** Раскладка главной, утверждённая для пользователя (отдел → роль → шаблон) */
  getDashboardLayout(role: Role): Promise<WorkspaceLayout>
}

const mockWorkspaceRepository: WorkspaceRepository = {
  async getDashboardLayout(role) {
    return defaultDashboardLayouts[role]
  },
}

/** Хранение раскладок на backend не согласовано — см. docs/API_CONTRACT.md. */
const httpWorkspaceRepository: WorkspaceRepository = {
  async getDashboardLayout() {
    return contractPending("раскладка рабочего пространства")
  },
}

export const workspaceRepository: WorkspaceRepository = isMockDataSource
  ? mockWorkspaceRepository
  : httpWorkspaceRepository
