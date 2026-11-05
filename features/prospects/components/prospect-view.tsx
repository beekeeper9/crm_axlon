import Link from "next/link"
import { ArrowUpRight, History, Mail, NotebookPen, Phone, Users } from "lucide-react"

import { ApiErrorState } from "@/components/shared/api-error-state"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { isMockDataSource } from "@/config/env"
import { prospectRoute, routes } from "@/config/routes"
import { loadConvertPipelines } from "@/features/prospects/api/convert-pipelines"
import { listProspectNotes, prospectsRepository } from "@/features/prospects/api/prospects-repository"
import { ProspectActions } from "@/features/prospects/components/prospect-actions"
import { ProspectNoteForm } from "@/features/prospects/components/prospect-notes"
import {
  PROSPECT_FIELD_LABELS,
  PROSPECT_HISTORY_LABELS,
  PROSPECT_SOURCE_LABELS,
  PROSPECT_STATUS_META,
} from "@/features/prospects/lib/prospect-meta"
import type { Prospect, ProspectDuplicate } from "@/features/prospects/schemas"
import { loadPeopleNames, teamRepository } from "@/features/team"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"
import { formatDateTime } from "@/lib/format"
import { hasPermission } from "@/lib/permissions/roles"
import type { CurrentUser } from "@/lib/session/current-user"

export const customerHref = (customerId: string) => `${routes.clientBase}?client=${encodeURIComponent(customerId)}`

function duplicateHref(candidate: ProspectDuplicate): string {
  return candidate.kind === "customer" ? customerHref(candidate.id) : prospectRoute(candidate.id)
}

/** Карточка входящего лида: контакты, действия, кандидаты в дубли и история */
export async function ProspectView({ prospect, user }: { prospect: Prospect; user: CurrentUser }) {
  const canAssign = hasPermission(user.role, "records.assign")
  const canEdit = !isMockDataSource && hasPermission(user.role, "records.edit")
  // Разделы грузятся независимо: ошибка истории не прячет карточку
  const [duplicates, history, members, notes, pipelines] = await Promise.all([
    tryLoad(() => prospectsRepository.getDuplicates(prospect.id)),
    tryLoad(() => prospectsRepository.getHistory(prospect.id)),
    canAssign && canEdit ? tryLoad(() => teamRepository.listMembers()) : Promise.resolve(null),
    isMockDataSource ? Promise.resolve(null) : tryLoad(async () => listProspectNotes(await getRenderAuth(), prospect.id, await loadPeopleNames())),
    canEdit ? tryLoad(loadConvertPipelines) : Promise.resolve(null),
  ])
  const status = PROSPECT_STATUS_META[prospect.status]
  const customerCandidates = duplicates.ok ? duplicates.data.filter((candidate) => candidate.kind === "customer") : []

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{prospect.name}</h1>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="text-meta text-muted-foreground">
            Входящий лид · {PROSPECT_SOURCE_LABELS[prospect.source]} · создан {formatDateTime(prospect.createdAt)}
          </p>
        </header>

        <section className="space-y-1.5 rounded-xl px-4 py-3 ring-1 ring-border" aria-label="Контакты">
          {prospect.phone && (
            <a href={`tel:${prospect.phone}`} className="flex items-center gap-2 text-sm tabular-nums hover:text-primary">
              <Phone className="size-3.5 text-muted-foreground" aria-hidden />
              {prospect.phone}
            </a>
          )}
          {prospect.email && (
            <a href={`mailto:${prospect.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Mail className="size-3.5 text-muted-foreground" aria-hidden />
              {prospect.email}
            </a>
          )}
          <p className="flex items-center gap-2 pt-1 text-meta text-muted-foreground">
            <PersonAvatar name={prospect.owner.name} />
            Ответственный: {prospect.owner.name}
          </p>
          {prospect.status === "unqualified" && prospect.disqualifyReason && (
            <p className="pt-1 text-meta text-muted-foreground">Причина отказа: {prospect.disqualifyReason}</p>
          )}
        </section>

        {prospect.convertedCustomerId ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm">
            Лид стал клиентом — дальше работайте в карточке клиента.
            <Link href={customerHref(prospect.convertedCustomerId)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Открыть клиента
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        ) : canEdit ? (
          <ProspectActions
            prospect={prospect}
            members={members?.ok ? members.data.map(({ id, name }) => ({ id, name })) : []}
            customerCandidates={customerCandidates.map(({ id, name, phone, email }) => ({ id, name, contact: phone ?? email }))}
            pipelines={pipelines?.ok ? pipelines.data : []}
          />
        ) : (
          isMockDataSource && <p className="text-meta text-muted-foreground">Демо-режим: действия с лидом доступны только с подключённым backend.</p>
        )}
      </div>

      <div className="space-y-4">
        {notes && (
          <section className="space-y-2" aria-labelledby="prospect-notes">
            <h2 id="prospect-notes" className="flex items-center gap-1.5 text-sm font-semibold">
              <NotebookPen className="size-4 text-muted-foreground" aria-hidden />
              Примечания
            </h2>
            {canEdit && <ProspectNoteForm prospectId={prospect.id} />}
            {!notes.ok ? (
              <ApiErrorState error={notes.error} bare />
            ) : notes.data.length === 0 ? (
              <p className="text-meta text-muted-foreground">Примечаний пока нет.</p>
            ) : (
              <ol className="space-y-2">
                {notes.data.map((note) => (
                  <li key={note.id} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                    <p className="whitespace-pre-line">{note.body}</p>
                    <p className="text-meta text-muted-foreground">
                      {formatDateTime(note.createdAt)} · {note.author}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <section className="space-y-2" aria-labelledby="prospect-duplicates">
          <h2 id="prospect-duplicates" className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-muted-foreground" aria-hidden />
            Возможные дубли
          </h2>
          {!duplicates.ok ? (
            <ApiErrorState error={duplicates.error} bare />
          ) : duplicates.data.length === 0 ? (
            <p className="text-meta text-muted-foreground">Других лидов и клиентов с этим телефоном или e-mail нет.</p>
          ) : (
            <>
              <p className="text-meta text-muted-foreground">
                Совпадает телефон или e-mail. Система не объединяет их сама: если это тот же человек, при конвертации привяжите лид к
                существующему клиенту.
              </p>
              <ul className="divide-y rounded-lg ring-1 ring-border">
                {duplicates.data.map((candidate) => (
                  <li key={`${candidate.kind}-${candidate.id}`}>
                    <Link href={duplicateHref(candidate)} className="group flex items-start gap-3 px-3 py-2 transition-colors hover:bg-accent/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{candidate.name}</p>
                        <p className="text-meta text-muted-foreground tabular-nums">
                          {candidate.kind === "customer" ? "Клиент" : "Лид"} · {[candidate.phone, candidate.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="space-y-2" aria-labelledby="prospect-history">
          <h2 id="prospect-history" className="flex items-center gap-1.5 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" aria-hidden />
            История
          </h2>
          {!history.ok ? (
            <ApiErrorState error={history.error} bare />
          ) : history.data.length === 0 ? (
            <p className="text-meta text-muted-foreground">Изменений пока нет.</p>
          ) : (
            <ol className="space-y-2">
              {history.data.map((entry, index) => (
                <li key={`${entry.occurredAt}-${index}`} className="text-sm">
                  <p>
                    {PROSPECT_HISTORY_LABELS[entry.action] ?? entry.action}
                    {entry.changedFields.length > 0 && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({entry.changedFields.map((field) => PROSPECT_FIELD_LABELS[field] ?? field).join(", ")})
                      </span>
                    )}
                    {entry.transfer && <span className="text-muted-foreground"> — {entry.transfer}</span>}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    {formatDateTime(entry.occurredAt)}
                    {entry.actor && ` · ${entry.actor.name}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

export function ProspectViewSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-9 w-96 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
