# MyRaices v23.7.15 — Cierre automático de pedidos digitales

- Los pedidos 100% digitales se marcan `completed` automáticamente después de confirmar el pago y habilitar las descargas.
- Registra `completed_at` y un evento en `order_status_history`.
- El email de un pedido digital muestra `Pago confirmado · Entrega digital completada`.
- Pedidos mixtos (digital + físico) mantienen el flujo físico normal; la descarga digital se habilita inmediatamente.
- No modifica taxes, delivery zones, inventario físico ni la seguridad de las descargas.
