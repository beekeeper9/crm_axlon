import { planUsageSchema, type PlanUsage } from "@/features/plan-limits/schemas"
import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"

/** Лимиты тарифа своей компании с использованием — для директора */
export function fetchPlanUsage(auth: ApiAuth): Promise<PlanUsage> {
  return apiRequest("/api/v1/subscription/usage/", { auth, schema: planUsageSchema })
}
