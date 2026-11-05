import { z } from "zod"

import type { ApiAuth } from "@/lib/api/auth-session"
import { apiRequest } from "@/lib/api/client"
import { PAGE_LIMIT_MAX, paginatedSchema } from "@/lib/api/pagination"

/**
 * Продукты компании (`/sales/products/`): что продаёт сделка — Польша, Болгария, курс SMM…
 * Список видят все; ведут директор и РОП (`pipelines.manage`, проверяет backend). Продукт
 * с `showOnMyDay` получает свой блок в «Моём дне» каждого менеджера.
 */

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  showOnMyDay: z.boolean(),
})

export type Product = z.infer<typeof productSchema>

export async function listProducts(auth: ApiAuth, activeOnly = false): Promise<Product[]> {
  const page = await apiRequest("/api/v1/sales/products/", {
    auth,
    query: { limit: PAGE_LIMIT_MAX, ...(activeOnly ? { active: "true" } : {}) },
    schema: paginatedSchema(productSchema),
  })
  return page.results
}

export async function createProduct(auth: ApiAuth, name: string): Promise<Product> {
  return apiRequest("/api/v1/sales/products/", { method: "POST", auth, body: { name, showOnMyDay: true }, schema: productSchema })
}

export async function updateProduct(
  auth: ApiAuth,
  productId: string,
  patch: { name?: string; isActive?: boolean; showOnMyDay?: boolean }
): Promise<Product> {
  return apiRequest(`/api/v1/sales/products/${encodeURIComponent(productId)}/`, { method: "PATCH", auth, body: patch, schema: productSchema })
}
