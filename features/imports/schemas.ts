import { z } from "zod"

/** Что загружаем: лиды попадают во «Входящие лиды», клиенты — в «Базу клиентов» */
export const IMPORT_ENTITIES = ["leads", "customers"] as const
export const importEntitySchema = z.enum(IMPORT_ENTITIES)
export type ImportEntity = z.infer<typeof importEntitySchema>

export const IMPORT_ENTITY_LABELS: Record<ImportEntity, string> = {
  leads: "Лиды",
  customers: "Клиенты",
}

/** new — будет создана; duplicate — уже есть в CRM или выше в файле; invalid — ошибка в строке */
export const importRowStatusSchema = z.enum(["new", "duplicate", "invalid"])
export type ImportRowStatus = z.infer<typeof importRowStatusSchema>

const previewRowSchema = z.object({
  line: z.int(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  source: z.string().nullable(),
  status: importRowStatusSchema,
  reason: z.string().nullable(),
  duplicateOf: z.object({ kind: z.string(), id: z.string(), name: z.string() }).nullable(),
  duplicateLine: z.int().nullable(),
})

/** `POST /imports/preview/` — разбор файла и проверка дублей без записи */
export const importPreviewSchema = z.object({
  entity: importEntitySchema,
  total: z.int(),
  new: z.int(),
  duplicates: z.int(),
  invalid: z.int(),
  rows: z.array(previewRowSchema),
})

export type ImportPreview = z.infer<typeof importPreviewSchema>
export type ImportPreviewRow = z.infer<typeof previewRowSchema>

/** `POST /imports/` и `GET /imports/` — итог загрузки (хранится на backend) */
export const importJobSchema = z.object({
  id: z.string(),
  entity: importEntitySchema,
  filename: z.string(),
  createdBy: z.string(),
  ownerUserId: z.string(),
  total: z.int(),
  created: z.int(),
  duplicates: z.int(),
  invalid: z.int(),
  failed: z.int(),
  errors: z.array(z.object({ line: z.int(), message: z.string() })),
  createdAt: z.iso.datetime({ offset: true }),
})

export type ImportJob = z.infer<typeof importJobSchema>

export type ImportRequest = {
  entity: ImportEntity
  filename: string
  /** Текст CSV, уже декодированный в браузере */
  content: string
  /** Ответственный за новые записи; null — тот, кто загружает */
  ownerUserId: string | null
}
