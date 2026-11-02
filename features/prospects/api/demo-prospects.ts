import type { Prospect } from "@/features/prospects/schemas"

/** Демо-набор входящих лидов (режим mock). В режиме api не используется */
export const demoProspects: readonly Prospect[] = [
  {
    id: "demo-prospect-1",
    name: "Айжан Токтосунова",
    email: null,
    phone: "+996555100200",
    source: "instagram",
    status: "new",
    owner: { id: "u-manager", name: "Демо-менеджер" },
    disqualifyReason: null,
    convertedCustomerId: null,
    version: 1,
    createdAt: "2026-11-02T09:15:00+06:00",
  },
  {
    id: "demo-prospect-2",
    name: "ОсОО «Северный ветер»",
    email: "info@north.example",
    phone: null,
    source: "website",
    status: "qualified",
    owner: { id: "u-manager", name: "Демо-менеджер" },
    disqualifyReason: null,
    convertedCustomerId: null,
    version: 2,
    createdAt: "2026-11-01T14:40:00+06:00",
  },
]
