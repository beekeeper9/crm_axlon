"use client"

import { useState, useTransition } from "react"
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "@/features/communications/actions"
import { TEMPLATE_BODY_MAX, TEMPLATE_TITLE_MAX, type MessageTemplate } from "@/features/communications/api/communications-repository"

type TemplatesManagerProps = {
  templates: readonly MessageTemplate[]
  /** Директор и РОП; менеджер видит шаблоны только для чтения */
  canManage: boolean
}

/** Editing — id шаблона, "new" — новый, null — форма закрыта */
type Editing = string | "new" | null

/** Шаблоны ответов компании: список, создание, правка и удаление с подтверждением */
export function TemplatesManager({ templates, canManage }: TemplatesManagerProps) {
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function remove(template: MessageTemplate) {
    startTransition(async () => {
      const message = await deleteTemplateAction(template.id)
      setFailure(message)
      if (!message) setDeleting(null)
    })
  }

  return (
    <div className="space-y-3">
      {canManage && editing !== "new" && (
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" aria-hidden />
          Новый шаблон
        </Button>
      )}
      {editing === "new" && <TemplateForm onDone={() => setEditing(null)} />}
      {templates.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted-foreground">
          Шаблонов пока нет.{canManage ? " Добавьте частые ответы — менеджеры вставят их в сообщение одним нажатием." : " Их добавляют директор или РОП."}
        </p>
      )}
      <ul className="space-y-2">
        {templates.map((template) =>
          editing === template.id ? (
            <li key={template.id}>
              <TemplateForm template={template} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={template.id}>
              <Card className="gap-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium">{template.title}</h3>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Изменить «${template.title}»`} onClick={() => setEditing(template.id)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Удалить «${template.title}»`} onClick={() => setDeleting(template)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-meta whitespace-pre-wrap text-muted-foreground">{template.body}</p>
              </Card>
            </li>
          )
        )}
      </ul>
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить шаблон?</DialogTitle>
            <DialogDescription>«{deleting?.title}» пропадёт у всех сотрудников компании. Уже отправленные сообщения не изменятся.</DialogDescription>
          </DialogHeader>
          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={() => deleting && remove(deleting)}>
              {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TemplateForm({ template, onDone }: { template?: MessageTemplate; onDone: () => void }) {
  const [title, setTitle] = useState(template?.title ?? "")
  const [body, setBody] = useState(template?.body ?? "")
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const prefix = template ? `template-${template.id}` : "template-new"

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const input = { title, body }
      const message = template ? await updateTemplateAction(template.id, input) : await createTemplateAction(input)
      setFailure(message)
      if (!message) onDone()
    })
  }

  return (
    <Card className="p-3">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-title`}>Название</Label>
          <Input id={`${prefix}-title`} value={title} maxLength={TEMPLATE_TITLE_MAX} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-body`}>Текст</Label>
          <Textarea id={`${prefix}-body`} value={body} rows={4} maxLength={TEMPLATE_BODY_MAX} onChange={(event) => setBody(event.target.value)} required />
        </div>
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Сохранить
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={isPending}>
            Отмена
          </Button>
        </div>
      </form>
    </Card>
  )
}
