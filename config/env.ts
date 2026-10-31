import { z } from "zod"


const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value)

/**
 * Модуль читается только на сервере Next.js (серверные компоненты, server actions, proxy.ts):
 * все запросы к Python API идут с сервера, поэтому адрес API не попадает в браузер.
 */
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
      env.NEXT_PUBLIC_DATA_SOURCE === "mock" || env.API_BASE_URL,
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
