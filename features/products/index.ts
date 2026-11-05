/**
 * Публичный API модуля «Продукты компании» (серверная часть). Клиентские формы берут
 * `ProductSelect` напрямую из `components/product-select`, чтобы не тянуть серверный код.
 */
export { listProducts, type Product } from "./api/products"
export { ProductsSection } from "./components/products-section"
