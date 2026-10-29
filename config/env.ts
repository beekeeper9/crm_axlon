import { z } from "zod"


const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value)

const envSchema = z
  .object({
    /** Базовый URL Python API. Обязателен, когда DATA_SOURCE = "api". */
    NEXT_PUBLIC_API_BASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    /** Источник данных: демо-данные или реальный backend. */
    NEXT_PUBLIC_DATA_SOURCE: z.preprocess(
      emptyToUndefined,
      z.enum(["mock", "api"]).default("mock")
    ),
  })
  .refine(
    (env) =>
      env.NEXT_PUBLIC_DATA_SOURCE === "mock" || env.NEXT_PUBLIC_API_BASE_URL,
    {
      message: "NEXT_PUBLIC_API_BASE_URL обязателен при NEXT_PUBLIC_DATA_SOURCE=api",
      path: ["NEXT_PUBLIC_API_BASE_URL"],
    }
  )

// Переменные перечислены явно: Next.js подставляет NEXT_PUBLIC_* только при прямом обращении.
export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
})

export const isMockDataSource = env.NEXT_PUBLIC_DATA_SOURCE === "mock"
