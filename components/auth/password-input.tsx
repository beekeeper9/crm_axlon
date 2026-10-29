"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">

/** Поле пароля с кнопкой «показать / скрыть» */
export function PasswordInput(props: PasswordInputProps) {
  const [isVisible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={isVisible ? "text" : "password"} className="pr-9" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={isVisible ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={isVisible}
        className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        {isVisible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}
