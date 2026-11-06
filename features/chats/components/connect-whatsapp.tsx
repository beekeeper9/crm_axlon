"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { routes } from "@/config/routes"

/**
 * Номер и токены задаются на сервере, API подключения у backend нет: кнопка объясняет шаги,
 * а панель сама уберёт её, когда сервер сообщит, что канал подключён.
 */
export function ConnectWhatsapp({ canOpenIntegrations }: { canOpenIntegrations: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Подключить WhatsApp</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Подключение WhatsApp</DialogTitle>
            <DialogDescription>
              Номер подключается на сервере CRM через партнёра Meta. Приложение WhatsApp Business на телефоне продолжит работать.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Получите у партнёра Meta App Secret, постоянный токен и Phone Number ID. Уточните, что Coexistence работает для вашего номера.</li>
            <li>Передайте эти данные администратору сервера защищённым способом, не в обычном чате.</li>
            <li>Администратор укажет у партнёра адрес вебхука и сотрудника, на которого будут падать новые лиды.</li>
          </ol>
          <p className="text-sm text-muted-foreground">Когда всё настроено, кнопка исчезнет, а новые обращения появятся в этой панели.</p>
          <DialogFooter>
            {canOpenIntegrations && (
              <Button variant="outline" nativeButton={false} render={<Link href={routes.settingsIntegrations} onClick={() => setOpen(false)} />}>
                Открыть «Интеграции»
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Понятно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
