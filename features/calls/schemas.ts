import { z } from "zod"

/**
 * Форма звонка в интерфейсе. В режиме api её собирает calls-repository из `/telephony/calls/`;
 * транскрипта, анализа и оценки там нет — они приходят null.
 * Факты звонка (кто, когда, сколько) и результат анализа ИИ — разные блоки:
 * анализ может отсутствовать, опаздывать или быть неточным, интерфейс показывает это честно.
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const callDirectionSchema = z.enum(["incoming", "outgoing"])

export const callSchema = z.object({
  id: z.string(),
  at: z.iso.datetime({ offset: true }),
  direction: callDirectionSchema,
  /** missed — входящий без ответа или исходящий без соединения; in_progress — звонок ещё идёт */
  status: z.enum(["answered", "missed", "in_progress"]),
  durationSec: z.int().nonnegative(),
  phone: z.string(),
  /** null — номер не привязан к лиду */
  lead: refSchema.nullable(),
  /** Клиент, если звонок привязан к клиенту, а не к сделке */
  client: refSchema.nullable().optional(),
  manager: refSchema,
  /** Есть ли запись разговора. Как её проигрывать (ссылка, права) — вопрос к backend */
  hasRecording: z.boolean(),
  /** Ссылка на запись у провайдера (backend хранит только ссылку) */
  recordingUrl: z.string().nullable().optional(),
  /** Заметка, которую оставили при записи звонка */
  notes: z.string().nullable().optional(),
  transcript: z.array(z.object({ speaker: z.enum(["manager", "client"]), text: z.string() })).nullable(),
  analysis: z
    .object({
      summary: z.string(),
      agreements: z.array(z.string()),
      objections: z.array(z.string()),
      nextAction: z.string().nullable(),
      /** Достигнута ли цель звонка (признак разбора в CRM: да / частично / нет) */
      goal: z.enum(["achieved", "partial", "missed"]).nullable(),
      generatedAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  /**
   * Оценка 1–5. Backend отдаёт её только руководителям; для остальных — null.
   * Интерфейс ничего не прячет сам: чего нет в ответе, того нет на экране.
   */
  rating: z.object({ score: z.int().min(1).max(5), comment: z.string().nullable() }).nullable(),
})

export type CallDirection = z.infer<typeof callDirectionSchema>
export type Call = z.infer<typeof callSchema>
