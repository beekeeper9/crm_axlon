import { z } from "zod"

/**
 * Входящий лид — заявка до клиента и сделки (`/api/v1/leads/`). Не путать со «сделкой»,
 * которую интерфейс исторически тоже называет лидом (`features/leads`).
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const prospectStatusSchema = z.enum(["new", "qualified", "unqualified", "converted"])
export const prospectSourceSchema = z.enum(["website", "referral", "whatsapp", "telegram", "instagram", "phone", "import", "other"])

export const prospectSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  source: prospectSourceSchema,
  status: prospectStatusSchema,
  owner: refSchema,
  disqualifyReason: z.string().nullable(),
  /** Клиент, в которого конвертирован лид */
  convertedCustomerId: z.string().nullable(),
  /** Для защиты от одновременной правки (409 при расхождении) */
  version: z.int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
})

export const prospectHistoryEntrySchema = z.object({
  action: z.string(),
  occurredAt: z.iso.datetime({ offset: true }),
  actor: refSchema.nullable(),
  /** Только названия полей: значения backend в историю не пишет */
  changedFields: z.array(z.string()),
  /** Передача лида: «от … к …» (null — запись не про передачу) */
  transfer: z.string().nullable().default(null),
})

/** Кандидат в дубли: другой лид или существующий клиент с тем же телефоном или e-mail */
export const prospectDuplicateSchema = z.object({
  kind: z.enum(["lead", "customer"]),
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  status: z.string().nullable(),
})

export type ProspectStatus = z.infer<typeof prospectStatusSchema>
export type ProspectSource = z.infer<typeof prospectSourceSchema>
export type Prospect = z.infer<typeof prospectSchema>
export type ProspectHistoryEntry = z.infer<typeof prospectHistoryEntrySchema>
export type ProspectDuplicate = z.infer<typeof prospectDuplicateSchema>
