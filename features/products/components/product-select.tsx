"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const NONE = "none"

type ProductSelectProps = {
  id: string
  products: readonly { id: string; name: string }[]
  value: string | null
  onChange: (productId: string | null) => void
}

/** Выбор продукта сделки; «Без продукта» — сделка не попадёт ни в один блок продуктов */
export function ProductSelect({ id, products, value, onChange }: ProductSelectProps) {
  if (products.length === 0) return null
  const items = [{ value: NONE, label: "Без продукта" }, ...products.map((product) => ({ value: product.id, label: product.name }))]
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Продукт</Label>
      <Select items={items} value={value ?? NONE} onValueChange={(next) => onChange(next === NONE || next === null ? null : next)}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
