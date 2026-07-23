-- Raíces v12.6 / NURAI v11.8.2
-- Evita que un payment.updated tardío de Square vuelva a marcar como pagado
-- un pedido ya reembolsado o cancelado.
begin;

create or replace function public.preserve_refund_order_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.payment_status in ('refunded','partially_refunded')
     and new.payment_status = 'completed' then
    new.payment_status := old.payment_status;
    new.refunded_amount := old.refunded_amount;
    new.refunded_at := old.refunded_at;
  end if;

  if old.status = 'cancelled' and new.status = 'paid' then
    new.status := old.status;
    new.cancelled_at := old.cancelled_at;
  end if;

  return new;
end;
$$;

drop trigger if exists preserve_refund_order_state_trigger on public.orders;
create trigger preserve_refund_order_state_trigger
before update of status, payment_status on public.orders
for each row execute function public.preserve_refund_order_state();

commit;
