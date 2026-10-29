"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** Переключатель «Оборот / Продажи»; оба графика уже отрисованы на сервере */
export function DailyTabs({ turnover, sales }: { turnover: React.ReactNode; sales: React.ReactNode }) {
  return (
    <Tabs defaultValue="turnover" className="gap-3">
      <TabsList>
        <TabsTrigger value="turnover" className="px-3">Оборот</TabsTrigger>
        <TabsTrigger value="sales" className="px-3">Продажи</TabsTrigger>
      </TabsList>
      <TabsContent value="turnover">{turnover}</TabsContent>
      <TabsContent value="sales">{sales}</TabsContent>
    </Tabs>
  )
}
