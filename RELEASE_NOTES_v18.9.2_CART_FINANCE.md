# MyRaices v18.9.2 — Carrito y costo histórico

- Conserva la referencia del pedido pendiente al salir hacia Square.
- Al regresar con Back, volver a la pestaña o cargar la tienda, consulta el estado del pedido.
- Vacía el carrito únicamente cuando el pago está confirmado.
- Guarda en cada línea del pedido el costo unitario histórico de producción, empaque y logística.
- Incluye SQL idempotente en `supabase/order_cost_snapshot_v18.9.2.sql`.
