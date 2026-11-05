import { ApiErrorState } from "@/components/shared/api-error-state"
import { listProducts } from "@/features/products/api/products"
import { ProductsEditor } from "@/features/products/components/products-editor"
import { tryLoad } from "@/lib/api/load"
import { getRenderAuth } from "@/lib/auth/token-store"

/** Продукты компании на странице справочников: директор и РОП ведут, остальные видят */
export async function ProductsSection({ editable }: { editable: boolean }) {
  const result = await tryLoad(async () => listProducts(await getRenderAuth()))
  return (
    <section aria-labelledby="list-products" className="space-y-2">
      <div className="space-y-0.5">
        <h2 id="list-products" className="text-base font-semibold">
          Продукты компании
        </h2>
        <p className="text-meta text-muted-foreground">
          Что продаёт сделка: например, «Польша» и «Болгария» или «Курс SMM». Менеджер выбирает продукт в сделке, а в его «Моём дне» появляется блок
          продаж по каждому продукту с отметкой «В «Моём дне»». Отключённый продукт остаётся в старых сделках.
        </p>
      </div>
      {result.ok ? <ProductsEditor products={result.data} editable={editable} /> : <ApiErrorState error={result.error} bare />}
    </section>
  )
}
