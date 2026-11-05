import { describe, expect, it } from "vitest"

import { allSectionsFor, homeRouteFor, primaryNavigationFor } from "@/config/navigation"
import { routes } from "@/config/routes"

const hrefs = (items: readonly { href: string }[]) => items.map((item) => item.href)
const catalog = (role: Parameters<typeof allSectionsFor>[0]) => hrefs(allSectionsFor(role).flatMap((group) => group.items))

describe("навигация по ролям", () => {
  it("менеджер: свой день и входящие лиды, без кабинета и сотрудников", () => {
    const nav = hrefs(primaryNavigationFor("manager"))
    expect(nav).toContain(routes.prospects)
    expect(nav).not.toContain(routes.team)
    expect(nav).not.toContain(routes.staff)
    expect(homeRouteFor("manager")).toBe(routes.myDay)
  })

  it("РОП: «Мой кабинет»; директор: «РОПы» вместо кабинета", () => {
    const rop = primaryNavigationFor("head_of_sales")
    expect(rop.find((item) => item.href === routes.team)?.title).toBe("Мой кабинет")
    const director = hrefs(primaryNavigationFor("director"))
    // «Входящие лиды» — перед «Продажами» (замечание владельца 05.11.2026)
    expect(director).toEqual([routes.company, routes.heads, routes.prospects, routes.sales, routes.staff])
    const ropHrefs = hrefs(rop)
    expect(ropHrefs.indexOf(routes.prospects)).toBe(ropHrefs.indexOf(routes.sales) - 1)
  })

  it("администратор платформы: разделы платформы в верхней панели", () => {
    expect(hrefs(primaryNavigationFor("platform_admin"))).toEqual([
      routes.platform,
      routes.platformCompanies,
      routes.platformErrors,
      routes.platformTickets,
    ])
  })

  it("«Все разделы» директора — согласованный состав", () => {
    expect(catalog("director")).toEqual(
      expect.arrayContaining([routes.tasks, routes.calls, routes.sales, routes.focus, routes.dailyReports, routes.clientBase, routes.assistant, routes.support])
    )
    expect(catalog("director")).not.toContain(routes.meetings)
  })

  it("каталог скрывает кабинет от менеджера", () => {
    expect(catalog("manager")).not.toContain(routes.team)
    expect(catalog("head_of_sales")).toContain(routes.team)
  })
})
