import { describe, expect, it } from "vitest"

import { allSections, homeRouteFor, primaryNavigationFor, visibleFor } from "@/config/navigation"
import { routes } from "@/config/routes"

const hrefs = (items: readonly { href: string }[]) => items.map((item) => item.href)

describe("навигация по ролям (режим api)", () => {
  it("менеджер: свой день и входящие лиды, без кабинета и сотрудников", () => {
    const nav = hrefs(primaryNavigationFor("manager"))
    expect(nav).toContain(routes.prospects)
    expect(nav).not.toContain(routes.team)
    expect(nav).not.toContain(routes.staff)
    expect(homeRouteFor("manager")).toBe(routes.myDay)
  })

  it("каталог разделов скрывает кабинет от менеджера и показывает РОПу", () => {
    const all = allSections.flatMap((group) => group.items)
    expect(hrefs(visibleFor(all, "manager"))).not.toContain(routes.team)
    expect(hrefs(visibleFor(all, "head_of_sales"))).toContain(routes.team)
  })

  it("неподключённый ИИ-помощник не выдаётся за рабочий раздел", () => {
    expect(hrefs(allSections.flatMap((group) => group.items))).not.toContain(routes.assistant)
  })

  it("стартовые страницы ролей", () => {
    expect(homeRouteFor("head_of_sales")).toBe(routes.team)
    expect(homeRouteFor("director")).toBe(routes.company)
  })
})
