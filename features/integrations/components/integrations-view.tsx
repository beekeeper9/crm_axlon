import { PlugZap } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { EmptyState } from "@/components/shared/empty-state"
import { ListPanel } from "@/components/shared/list-panel"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { fetchIntegrations, type Integration } from "@/features/integrations/api/integrations-repository"
import { IntegrationCheckButton } from "@/features/integrations/components/integration-check-button"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDateTime, formatNumber } from "@/lib/format"

/**
 * Каналы компании: принимаются ли входящие, подключена ли отправка, счётчики и последние ошибки.
 * «Подключено» показываем только по данным backend — без учётных данных провайдера канал не подключён.
 */
export async function IntegrationsView() {
  if (isMockDataSource) {
    return (
      <ListPanel>
        <EmptyState icon={PlugZap} title="Интеграции видны только с сервером" description="В демо-режиме подключений нет." />
      </ListPanel>
    )
  }
  const integrations = await tryLoad(async () => fetchIntegrations(await getRenderAuth()))
  if (!integrations.ok) return <ApiErrorState error={integrations.error} />
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {integrations.data.map((integration) => (
        <IntegrationCard key={integration.provider} integration={integration} />
      ))}
    </div>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{integration.title}</h2>
        {integration.outboundConnected ? (
          <StatusBadge tone="success">Подключено</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Не подключено</StatusBadge>
        )}
      </div>
      <dl className="text-meta grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Входящие</dt>
        <dd>{integration.inboundConfigured ? "принимаются" : "не настроены: на сервере не задан секрет подписи"}</dd>
        <dt className="text-muted-foreground">Отправка</dt>
        <dd>{integration.outboundConnected ? "подключена" : "не подключена — нужны данные провайдера (токен, номер или бот)"}</dd>
        <dt className="text-muted-foreground">Адрес для провайдера</dt>
        <dd className="break-all font-mono text-xs">{integration.webhookPath}</dd>
        <dt className="text-muted-foreground">Получено событий</dt>
        <dd>
          {formatNumber(integration.receivedTotal)} всего, {formatNumber(integration.receivedLast24h)} за сутки
          {integration.lastReceivedAt && `, последнее ${formatDateTime(integration.lastReceivedAt)}`}
        </dd>
        <dt className="text-muted-foreground">С ошибкой</dt>
        <dd className={integration.failedTotal > 0 ? "text-destructive" : undefined}>{formatNumber(integration.failedTotal)}</dd>
      </dl>
      {integration.recentErrors.length > 0 && (
        <details className="text-meta">
          <summary className="cursor-pointer">Журнал ошибок ({formatNumber(integration.recentErrors.length)})</summary>
          <ul className="mt-1 space-y-1">
            {integration.recentErrors.map((entry) => (
              <li key={`${entry.receivedAt}-${entry.error}`} className="break-words">
                <span className="text-muted-foreground">{formatDateTime(entry.receivedAt)}</span> — {entry.error}
              </li>
            ))}
          </ul>
        </details>
      )}
      <IntegrationCheckButton provider={integration.provider} />
    </Card>
  )
}

export function IntegrationsViewSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-56 w-full rounded-xl" />
      ))}
    </div>
  )
}
