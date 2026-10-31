import { z } from "zod"


const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value)

/**
 * Все запросы к Python API идут с сервера Next.js, поэтому адрес API не попадает в браузер.
 * `isMockDataSource` нужен и клиентским компонентам (через lib/permissions/edit-mode.ts):
 * в браузере API_BASE_URL всегда пуст, поэтому обязательность адреса проверяется только на сервере.
 */
const isServer = typeof window === "undefined"

const envSchema = z
  .object({
    /** Базовый URL Django API, только для сервера. Обязателен, когда DATA_SOURCE = "api". */
    API_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    /** Источник данных: демо-данные или реальный backend. */
    NEXT_PUBLIC_DATA_SOURCE: z.preprocess(
      emptyToUndefined,
      z.enum(["mock", "api"]).default("mock")
    ),
  })
  .refine(
    (env) =>
      env.NEXT_PUBLIC_DATA_SOURCE === "mock" || env.API_BASE_URL || !isServer,
    {
      message: "API_BASE_URL обязателен при NEXT_PUBLIC_DATA_SOURCE=api",
      path: ["API_BASE_URL"],
    }
  )

// Переменные перечислены явно: Next.js подставляет NEXT_PUBLIC_* только при прямом обращении.
export const env = envSchema.parse({
  API_BASE_URL: process.env.API_BASE_URL,
  NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
})

export const isMockDataSource = env.NEXT_PUBLIC_DATA_SOURCE === "mock"
