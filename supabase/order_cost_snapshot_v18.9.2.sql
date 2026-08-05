-- MyRaices v18.9.2 · Costo histórico por artículo vendido
-- Ejecutar una sola vez antes del despliegue. Es idempotente.

alter table public.order_items
  add column if not exists unit_cost_snapshot numeric(12,4);

comment on column public.order_items.unit_cost_snapshot is
  'Costo unitario total (producción + empaque + logística) congelado al momento de la venta.';
