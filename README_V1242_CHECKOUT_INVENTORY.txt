RAÍCES v12.4.2 — Checkout validation + inventory

1. Upload this version to GitHub/Netlify.
2. BEFORE processing another real payment, run this file once in Supabase SQL Editor:
   supabase/complete_paid_order_inventory_v1242.sql

Changes:
- The payment button now explains exactly which checkout field is missing.
- A verified Google delivery address is required for physical/mixed carts.
- Terms and purchase policies must be accepted before opening Square.
- A completed Square payment deducts products.stock automatically.
- The inventory operation is atomic and idempotent: repeated Square webhooks do not deduct stock twice.
- When stock reaches 0, products.status changes to sold_out.
