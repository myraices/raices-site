-- Raíces v12.4.2
-- Run once in the same Supabase project used by the public store and NURAI.
-- Atomically confirms a Square payment and deducts inventory exactly once.

begin;

alter table public.orders
  add column if not exists inventory_deducted_at timestamptz;

create or replace function public.complete_paid_order_and_deduct_inventory(
  p_order_id uuid,
  p_square_payment_id text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_current_stock numeric;
  v_new_stock numeric;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Square may resend the same webhook. Never deduct inventory twice.
  if v_order.inventory_deducted_at is not null then
    update public.orders
       set status = 'paid',
           payment_status = 'completed',
           square_payment_id = coalesce(p_square_payment_id, square_payment_id),
           paid_at = coalesce(paid_at, p_paid_at),
           updated_at = now()
     where id = p_order_id;

    return jsonb_build_object('ok', true, 'already_processed', true);
  end if;

  for v_item in
    select sku, quantity
    from public.order_items
    where order_id = p_order_id
    order by id
  loop
    select stock into v_current_stock
    from public.products
    where sku = v_item.sku
    for update;

    if found and v_current_stock is not null then
      v_new_stock := greatest(v_current_stock - v_item.quantity, 0);

      update public.products
         set stock = v_new_stock,
             status = case when v_new_stock <= 0 then 'sold_out' else status end,
             updated_at = now()
       where sku = v_item.sku;
    end if;
  end loop;

  update public.orders
     set status = 'paid',
         payment_status = 'completed',
         square_payment_id = p_square_payment_id,
         paid_at = p_paid_at,
         inventory_deducted_at = now(),
         updated_at = now()
   where id = p_order_id;

  return jsonb_build_object('ok', true, 'already_processed', false);
end;
$$;

revoke all on function public.complete_paid_order_and_deduct_inventory(uuid,text,timestamptz) from public;
grant execute on function public.complete_paid_order_and_deduct_inventory(uuid,text,timestamptz) to service_role;

commit;
