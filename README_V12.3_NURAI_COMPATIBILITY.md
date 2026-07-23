# MyRaices v12.3 — Square Sandbox + NURAI compatibility

This version preserves both database formats:

- NURAI legacy monetary fields in dollars:
  - orders.subtotal
  - orders.delivery_amount
  - orders.tax_amount
  - orders.total_amount
  - order_items.unit_price
  - order_items.line_total
  - order_items.variant_name

- Square integration fields in cents:
  - orders.subtotal_cents
  - orders.delivery_cents
  - orders.tax_cents
  - orders.total_cents
  - order_items.unit_price_cents
  - order_items.line_total_cents

Payment statuses are normalized for NURAI:
- pending
- completed
- failed

No SQL migration is required for this patch if the previous v12 columns were already added.
