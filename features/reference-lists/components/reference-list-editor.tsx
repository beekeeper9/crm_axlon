"use client"

import { useState, useTransition } from "react"
import { ArrowDown, ArrowUp, Check, LoaderCircle, Pencil, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addReferenceItemAction, reorderReferenceListAction, updateReferenceItemAction } from "@/features/reference-lists/actions"
import { moveItem, REFERENCE_LIST_META, type ReferenceItem, type ReferenceListKey } from "@/features/reference-lists/lib/lists"
import { cn } from "@/lib/utils"

type EditorProps = { listKey: ReferenceListKey; items: readonly ReferenceItem[]; editable: boolean }

/** Один справочник: директор добавляет, переименовывает, скрывает и сортирует; остальные читают */
export function ReferenceListEditor({ listKey, items, editable }: EditorProps) {
  const meta = REFERENCE_LIST_META[listKey]
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [newLabel, setNewLabel] = useState("")

  function run(operation: () => Promise<string | null>, onDone?: () => void) {
    startTransition(async () => {
      const message = await operation()
      setFailure(message)
      if (message === null) onDone?.()
    })
  }

  const move = (index: number, direction: -1 | 1) => {
    const next = moveItem(items, index, direction)
    if (next) run(() => reorderReferenceListAction(listKey, next.map((item) => item.ref)))
  }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Список пуст{editable && meta.canAdd ? " — добавьте первый пункт." : "."}</p>
      ) : (
        <ul className="divide-y rounded-xl ring-1 ring-border">
          {items.map((item, index) => (
            <li key={item.ref} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              {editing === item.ref ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    run(() => updateReferenceItemAction(listKey, item.ref, { label: draft }), () => setEditing(null))
                  }}
                >
                  <Input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={100} aria-label="Новое название" autoFocus className="h-8" />
                  <Button type="submit" size="icon-sm" variant="ghost" aria-label="Сохранить" disabled={isPending}>
                    <Check aria-hidden />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Отменить правку" onClick={() => setEditing(null)}>
                    <X aria-hidden />
                  </Button>
                </form>
              ) : (
                <>
                  <span className={cn("flex-1", !item.isActive && "text-muted-foreground line-through")}>{item.label}</span>
                  {!item.isActive && <span className="text-xs text-muted-foreground">скрыт из форм</span>}
                </>
              )}
              {editable && editing !== item.ref && (
                <div className="flex items-center gap-1">
                  {meta.canReorder && (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Выше: ${item.label}`} disabled={isPending || index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Ниже: ${item.label}`} disabled={isPending || index === items.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown aria-hidden />
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Переименовать: ${item.label}`}
                    disabled={isPending}
                    onClick={() => {
                      setDraft(item.label)
                      setEditing(item.ref)
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => updateReferenceItemAction(listKey, item.ref, { isActive: !item.isActive }))}>
                    {item.isActive ? "Скрыть" : "Вернуть"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && meta.canAdd && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => addReferenceItemAction(listKey, newLabel), () => setNewLabel(""))
          }}
        >
          <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} maxLength={100} placeholder="Новый пункт" aria-label={`Новый пункт: ${meta.title}`} className="h-8 max-w-sm" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending || newLabel.trim() === ""}>
            {isPending ? <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden /> : <Plus data-icon="inline-start" aria-hidden />}
            Добавить
          </Button>
        </form>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
    </div>
  )
}
