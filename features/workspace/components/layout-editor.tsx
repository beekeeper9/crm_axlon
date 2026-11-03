"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Eye, EyeOff, LoaderCircle, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { saveLayoutAction } from "@/features/workspace/actions"
import { BLOCK_LABELS, DEFAULT_LAYOUT, type WorkspaceBlock } from "@/features/workspace/lib/blocks"
import { cn } from "@/lib/utils"

/** Порядок и видимость блоков «Моего дня» для выбранной области (компания или отдел) */
export function LayoutEditor({ departmentId, initial }: { departmentId: string | null; initial: readonly WorkspaceBlock[] }) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<WorkspaceBlock[]>([...initial])
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const isChanged = JSON.stringify(blocks) !== JSON.stringify(initial)

  function move(index: number, delta: -1 | 1) {
    setBlocks((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setMessage(null)
  }

  function toggle(index: number) {
    setBlocks((current) => current.map((block, i) => (i === index ? { ...block, visible: !block.visible } : block)))
    setMessage(null)
  }

  function save() {
    startTransition(async () => {
      const error = await saveLayoutAction(departmentId, blocks)
      setMessage(error ? { tone: "error", text: error } : { tone: "ok", text: "Сохранено. Менеджеры увидят новую раскладку при следующем открытии «Моего дня»." })
      if (!error) router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <ol className="divide-y rounded-xl ring-1 ring-border">
        {blocks.map((block, index) => {
          const label = BLOCK_LABELS[block.id]
          return (
            <li key={block.id} className={cn("flex items-center gap-3 px-4 py-3", !block.visible && "bg-muted/40")}>
              <span className="w-5 text-meta text-muted-foreground tabular-nums">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", !block.visible && "text-muted-foreground line-through")}>{label.title}</p>
                <p className="text-meta text-muted-foreground">{label.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0 || isPending} aria-label={`Поднять «${label.title}»`}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === blocks.length - 1 || isPending} aria-label={`Опустить «${label.title}»`}>
                  <ArrowDown aria-hidden />
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggle(index)} disabled={isPending} aria-pressed={block.visible}>
                  {block.visible ? <Eye data-icon="inline-start" aria-hidden /> : <EyeOff data-icon="inline-start" aria-hidden />}
                  {block.visible ? "Показан" : "Скрыт"}
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={isPending || !isChanged}>
          {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
          Сохранить
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setBlocks([...DEFAULT_LAYOUT])
            setMessage(null)
          }}
          disabled={isPending}
        >
          <RotateCcw data-icon="inline-start" aria-hidden />
          Как по умолчанию
        </Button>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={cn("text-sm", message.tone === "error" ? "text-destructive" : "text-success")}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
