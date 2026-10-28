"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type LeadTab = {
  value: string
  label: string
  count?: number
  content: React.ReactNode
}

/** Вкладки карточки лида. Содержимое отрисовано на сервере и передано сюда готовым. */
export function LeadTabs({ tabs }: { tabs: readonly LeadTab[] }) {
  return (
    <Tabs defaultValue={tabs[0]?.value}>
      <div className="overflow-x-auto border-b">
        <TabsList variant="line" className="h-10">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-2.5">
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded bg-muted px-1 text-xs text-muted-foreground tabular-nums">{tab.count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="pt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
