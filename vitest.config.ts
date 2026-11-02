import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Режим api: http-репозитории; транспорт в тестах подменяется
    env: { NEXT_PUBLIC_DATA_SOURCE: "api", API_BASE_URL: "http://api.test" },
  },
})
