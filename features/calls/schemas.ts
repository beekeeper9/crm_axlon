import { z } from "zod"

/**
 * Предлагаемая форма звонка. НЕ согласована с backend.
 * Факты звонка (кто, когда, сколько) и результат анализа ИИ — разные блоки:
 * анализ может отсутствовать, опаздывать или быть неточным, интерфейс показывает это честно.
 */

const refSchema = z.object({ id: z.string(), name: z.string() })

export const callDirectionSchema = z.enum(["incoming", "outgoing"])

export const callSchema = z.object({
  id: z.string(),
  at: z.iso.datetime({ offset: true }),
  direction: callDirectionSchema,
  /** missed — входящий без ответа или исходящий без соединения */
  status: z.enum(["answered", "missed"]),
  durationSec: z.int().nonnegative(),
  phone: z.string(),
  /** null — номер не привязан к лиду */
  lead: refSchema.nullable(),
  manager: refSchema,
  /** Есть ли запись разговора. Как её проигрывать (ссылка, права) — вопрос к backend */
  hasRecording: z.boolean(),
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
