/** Единый источник путей приложения. Не пишем "/deals" строками по коду. */
export const routes = {
  dashboard: "/dashboard",
  deals: "/deals",
  contacts: "/contacts",
  tasks: "/tasks",
  calls: "/calls",
  meetings: "/meetings",
  analytics: "/analytics",
  workspace: "/workspace",
} as const

export type AppRoute = (typeof routes)[keyof typeof routes]
