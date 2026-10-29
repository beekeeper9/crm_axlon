import { isMockDataSource } from "@/config/env"
import { DEMO_LOGIN_HINTS } from "@/mocks/demo-accounts.seed"

/** Тестовые входы для подсказки на странице входа — только в демо-режиме, в режиме api пусто */
export function demoLoginHints(): readonly { label: string; login: string; password: string }[] {
  return isMockDataSource ? DEMO_LOGIN_HINTS : []
}
