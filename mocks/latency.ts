import { connection } from "next/server"

/** Задержка, чтобы в демо-режиме были видны состояния загрузки, как с реальным API. */
const DEFAULT_LATENCY_MS = 450

export async function simulateLatency(ms: number = DEFAULT_LATENCY_MS): Promise<void> {
  // Данные «запрашиваются» в момент запроса страницы, как будет с настоящим backend.
  await connection()
  await new Promise((resolve) => setTimeout(resolve, ms))
}
