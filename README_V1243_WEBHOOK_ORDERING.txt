Raíces v12.4.3 — Square webhook ordering fix

Corrección:
- Square puede reenviar payment.created y payment.updated fuera de orden.
- Un evento intermedio ya no puede cambiar a pending_payment o cancelled un pedido que ya esté pagado.
- Se considera confirmado si status=paid, payment_status=completed, paid_at existe o inventory_deducted_at existe.
- El evento COMPLETED sigue llamando la función atómica de Supabase y descuenta inventario una sola vez.

No requiere ejecutar un SQL nuevo si ya se ejecutó:
supabase/complete_paid_order_inventory_v1242.sql
