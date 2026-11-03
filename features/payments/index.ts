/**
 * Публичные части модуля оплат, которые можно импортировать и в клиентские компоненты.
 * Серверные загрузчики и экраны — по прямым путям (`api/payments-api`, `components/payment-review-view`).
 */
export { RecordSalePaymentDialog } from "./components/record-sale-payment-dialog"
export { ReceiptField } from "./components/receipt-field"
export { submitPayment, type RecordPaymentInput } from "./api/record-payment"
export { PAYMENT_REVIEW_PATH } from "./paths"
export type { DealPaymentSummary, Payment, PaymentStatus } from "./schemas"
