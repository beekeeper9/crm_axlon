"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Check, Code, Copy, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { revokeWebFormKeyAction } from "@/features/web-forms/actions"
import type { WebFormKey } from "@/features/web-forms/api/web-forms-repository"
import { buildEmbedSnippet, publicEndpointUrl } from "@/features/web-forms/lib/snippet"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type CopyTarget = { keyId: string; what: "url" | "snippet" }
type CopyState = { target: CopyTarget; ok: boolean } | null

/** Ключи форм сайта: адрес отправки, готовый код формы, отзыв с подтверждением */
export function WebFormKeyList({ keys }: { keys: readonly WebFormKey[] }) {
  const [copied, setCopied] = useState<CopyState>(null)
  const [openSnippet, setOpenSnippet] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<WebFormKey | null>(null)

  async function copy(target: CopyTarget, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied({ target, ok: true })
    } catch {
      setCopied({ target, ok: false })
    }
  }

  function copyResult(target: CopyTarget): boolean | null {
    if (copied?.target.keyId !== target.keyId || copied.target.what !== target.what) return null
    return copied.ok
  }

  function copyButton(target: CopyTarget, text: string, idle: string) {
    const result = copyResult(target)
    return (
      <Button size="sm" variant="outline" onClick={() => copy(target, text)}>
        {result ? <Check data-icon="inline-start" aria-hidden /> : <Copy data-icon="inline-start" aria-hidden />}
        {result === null ? idle : result ? "Скопировано" : "Не удалось — выделите и скопируйте вручную"}
      </Button>
    )
  }

  return (
    <>
      <ul className="divide-y rounded-xl ring-1 ring-border">
        {keys.map((key) => {
          const url = publicEndpointUrl(key.endpointPath)
          const snippet = buildEmbedSnippet(key.endpointPath)
          return (
            <li key={key.id} className={cn("space-y-2 px-4 py-3", !key.isActive && "opacity-70")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {key.name}{" "}
                    <span className={cn("ml-1 rounded px-1.5 py-0.5 text-xs", key.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {key.isActive ? "Активен" : "Отозван"}
                    </span>
                  </p>
                  <p className="text-meta text-muted-foreground">
                    {key.departmentName ?? "Отдел"} · создал {key.createdByName ?? "сотрудник"} {formatDateTime(key.createdAt)}
                    {key.revokedAt && ` · отозван ${formatDateTime(key.revokedAt)}`}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    Заявок: {key.leadsCount}
                    {key.lastUsedAt ? ` · последняя ${formatDateTime(key.lastUsedAt)}` : " · заявок ещё не было"}
                  </p>
                </div>
                {key.isActive && (
                  <Button size="sm" variant="destructive" onClick={() => setRevoking(key)}>
                    <Ban data-icon="inline-start" aria-hidden />
                    Отозвать
                  </Button>
                )}
              </div>

              {key.isActive && (
                <>
                  <code className="block rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs break-all select-all">{url}</code>
                  <div className="flex flex-wrap gap-2">
                    {copyButton({ keyId: key.id, what: "url" }, url, "Скопировать адрес")}
                    {copyButton({ keyId: key.id, what: "snippet" }, snippet, "Скопировать код формы")}
                    <Button size="sm" variant="ghost" aria-expanded={openSnippet === key.id} onClick={() => setOpenSnippet(openSnippet === key.id ? null : key.id)}>
                      <Code data-icon="inline-start" aria-hidden />
                      {openSnippet === key.id ? "Скрыть код" : "Показать код"}
                    </Button>
                  </div>
                  {openSnippet === key.id && (
                    <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs whitespace-pre select-all">{snippet}</pre>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
      <RevokeDialog keyToRevoke={revoking} onClose={() => setRevoking(null)} />
    </>
  )
}

function RevokeDialog({ keyToRevoke, onClose }: { keyToRevoke: WebFormKey | null; onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFailure(null)
    onClose()
  }

  function revoke(key: WebFormKey) {
    startTransition(async () => {
      const result = await revokeWebFormKeyAction(key.id)
      if (result.ok) {
        close()
        router.refresh()
      } else setFailure(result.message)
    })
  }

  return (
    <Dialog open={keyToRevoke !== null} onOpenChange={(open) => !open && !isPending && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Отозвать ключ «{keyToRevoke?.name}»?</DialogTitle>
          <DialogDescription>
            Форма на сайте с этим ключом сразу перестанет принимать заявки. Вернуть ключ нельзя — для формы понадобится новый ключ и новый код.
          </DialogDescription>
        </DialogHeader>
        {failure && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {failure}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isPending}>
            Отмена
          </Button>
          <Button type="button" variant="destructive" disabled={isPending || !keyToRevoke} onClick={() => keyToRevoke && revoke(keyToRevoke)}>
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Отозвать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
