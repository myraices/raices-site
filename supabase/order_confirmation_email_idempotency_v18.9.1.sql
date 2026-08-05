-- MyRaices v18.9.1 · Confirmación idempotente de pedidos pagados
-- Ejecutar una sola vez en Supabase SQL Editor ANTES de publicar la nueva versión.
begin;

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'Fecha en que se envió al cliente el correo único de pedido y pago confirmado.';

commit;
