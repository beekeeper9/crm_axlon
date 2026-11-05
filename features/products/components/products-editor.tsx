"use client"

import { useState, useTransition } from "react"
import { Check, LoaderCircle, Pencil, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createProductAction, updateProductAction, type ProductActionResult } from "@/features/products/actions"
import type { Product } from "@/features/products/api/products"
import { cn } from "@/lib/utils"

/** Список продуктов: добавить, переименовать, включить блок в «Моём дне», отключить */
export function ProductsEditor({ products, editable }: { products: readonly Product[]; editable: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [failure, setFailure] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [newName, setNewName] = useState("")

  function run(operation: () => Promise<ProductActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const message = await operation()
      setFailure(message)
      if (message === null) onDone?.()
    })
  }

  return (
    <div className="space-y-2">
      {products.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Продуктов пока нет{editable ? " — добавьте первый." : "."}</p>
      ) : (
        <ul className="divide-y rounded-xl ring-1 ring-border">
          {products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              {editing === product.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    run(() => updateProductAction(product.id, { name: draft }), () => setEditing(null))
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
                  <span className={cn("flex-1", !product.isActive && "text-muted-foreground line-through")}>{product.name}</span>
                  {!product.isActive && <span className="text-xs text-muted-foreground">отключён</span>}
                </>
              )}
              {editing !== product.id && (
                <label className={cn("flex items-center gap-1.5 text-xs", !editable && "text-muted-foreground")}>
                  <input
                    type="checkbox"
                    className="size-4 accent-(--primary)"
                    checked={product.showOnMyDay}
                    disabled={!editable || isPending || !product.isActive}
                    onChange={(event) => run(() => updateProductAction(product.id, { showOnMyDay: event.target.checked }))}
                  />
                  В «Моём дне»
                </label>
              )}
              {editable && editing !== product.id && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Переименовать: ${product.name}`}
                    disabled={isPending}
                    onClick={() => {
                      setDraft(product.name)
                      setEditing(product.id)
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={isPending} onClick={() => run(() => updateProductAction(product.id, { isActive: !product.isActive }))}>
                    {product.isActive ? "Отключить" : "Вернуть"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => createProductAction(newName), () => setNewName(""))
          }}
        >
          <Input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={100} placeholder="Новый продукт" aria-label="Новый продукт" className="h-8 max-w-sm" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending || newName.trim() === ""}>
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
