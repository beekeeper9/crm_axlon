import type { Metadata } from "next"
import { ExternalLink, FileText } from "lucide-react"

import { ListPanel } from "@/components/shared/list-panel"
import { PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Материалы" }

/**
 * Инструкции компании (список из ТЗ, раздел «Материалы»). Файлы хранятся в Google Drive;
 * доступ к ним даёт владелец документов, CRM только собирает ссылки в одном месте.
 */
const INSTRUCTIONS: readonly { title: string; href: string }[] = [
  { title: "Как работать в CRM", href: "https://drive.google.com/file/d/1pAHsBqH0iv9vESXKbDnp994nKhlzjnsW/view" },
  { title: "Задачи, «Фокус» и «Мой день»", href: "https://drive.google.com/file/d/1MgNZobW8wrh48FjTeq1YIHR1y0dqhXF2/view" },
  { title: "Как назначить и подтвердить встречу", href: "https://drive.google.com/file/d/1LX927no2aZkNlOqaR2tKxDKcNus25w_Q/view" },
  { title: "Клиент не пришёл или перенёс встречу", href: "https://drive.google.com/file/d/1LmepDb8efiQbQy4uUnO3G4jMcqMB_9eD/view" },
  { title: "Что делать после встречи", href: "https://drive.google.com/file/d/1zVlcDDqM3PQ7LGiTewJ447rsO5GYqsCF/view" },
  { title: "Как принять оплату", href: "https://drive.google.com/file/d/1SiFayEQNBVQpnigu-UjiGA_aN_TgAUgy/view" },
  { title: "Закрытие сделки и причины отказа", href: "https://drive.google.com/file/d/1OTccJVCkIIyY7y-E9WYr8bCe31vm0Zsn/view" },
  { title: "Клиент вернулся или пришёл повторно", href: "https://drive.google.com/file/d/1olpj1QQXh0eOKd8KTgGnmaj4Hm1r0QYM/view" },
  { title: "Передача лида и отпуска", href: "https://drive.google.com/file/d/1vwDVPoLfqEwHkH4-mNwHuLP88bmF4nKb/view" },
  { title: "Очередь лидоруба /next", href: "https://drive.google.com/file/d/1Uv3G3xIDKTw3p0T_S8CadsZD3TTe9A4M/view" },
  { title: "Звонки", href: "https://drive.google.com/file/d/1uxXqMD_idaHSJvgwXBj73wCb1XdYCQrN/view" },
  { title: "Чаты и шаблоны", href: "https://drive.google.com/file/d/18DSIiq7vb8ZOSUB0dnZzkujcIcmwmawE/view" },
  { title: "Бот и менеджер: кто и когда пишет", href: "https://drive.google.com/file/d/1qpaEjKn8SUlvLtYWOEvo6pdYicRve0Wx/view" },
  { title: "Отчёт дня: как читать", href: "https://drive.google.com/file/d/1aKZh86JlvmBkJyH22xVJ_YvzJJB8Oari/view" },
  { title: "Документы клиента и паспорт", href: "https://drive.google.com/file/d/1_byLbSleeI5eygfQh_vFREd3GW-gCgHX/view" },
]

export default function MaterialsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Материалы" description="Инструкции по работе с клиентами и в CRM. Открываются в Google Drive." />
      <ListPanel>
        <ul className="divide-y">
          {INSTRUCTIONS.map((instruction) => (
            <li key={instruction.href}>
              <a
                href={instruction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/50"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">{instruction.title}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="sr-only">(откроется в новой вкладке)</span>
              </a>
            </li>
          ))}
        </ul>
      </ListPanel>
    </div>
  )
}
