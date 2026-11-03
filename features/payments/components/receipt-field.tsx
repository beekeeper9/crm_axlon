"use client"

import { useId, useRef } from "react"
import { FileText, ImageIcon, Paperclip, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RECEIPT_ACCEPT, formatFileSize, receiptProblem } from "@/features/payments/schemas"

type ReceiptFieldProps = {
  file: File | null
  onChange: (file: File | null) => void
  /** Для возврата чек не обязателен */
  optional?: boolean
}

/** Чек или квитанция: PDF или фото до 10 МБ; имя и размер видны до отправки */
export function ReceiptField({ file, onChange, optional = false }: ReceiptFieldProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const problem = file ? receiptProblem(file) : null
  const Icon = file?.name.toLowerCase().endsWith(".pdf") ? FileText : ImageIcon

  function clear() {
    onChange(null)
    if (input.current) input.current.value = ""
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Чек или квитанция{optional ? " (необязательно)" : ""}</Label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-border">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={file.name}>
            {file.name}
          </span>
          <span className="shrink-0 text-meta text-muted-foreground tabular-nums">{formatFileSize(file.size)}</span>
          <Button type="button" size="icon-sm" variant="ghost" onClick={clear} aria-label="Убрать файл">
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="justify-start" onClick={() => input.current?.click()}>
          <Paperclip data-icon="inline-start" aria-hidden />
          Выбрать файл
        </Button>
      )}
      {problem ? (
        <p role="alert" className="text-meta text-destructive">
          {problem}
        </p>
      ) : (
        <p className="text-meta text-muted-foreground">PDF или фото (JPEG, PNG, WEBP, HEIC), не больше 10 МБ.</p>
      )}
    </div>
  )
}
