-- MyRaices / NURAI · Checkout intent separado de Pedido
-- Objetivo: no crear orders hasta que Square confirme payment COMPLETED.
-- Idempotente.

begin;

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'created'
    check (status in ('created','square_ready','payment_completed','order_created','failed','expired')),
  payload jsonb not null default '{}'::jsonb,
  environment text not null default 'sandbox',
  square_order_id text unique,
  square_payment_link_id text,
  order_id uuid unique references public.orders(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_sessions_status_created_idx
  on public.checkout_sessions(status, created_at desc);

alter table public.checkout_sessions enable row level security;

-- No client access. Netlify uses service_role.
revoke all on public.checkout_sessions from anon, authenticated;

create or replace function public.nurai_create_order_from_checkout_session(
  p_session_id uuid,
  p_square_order_id text,
  p_square_payment_id text,
  p_paid_at timestamptz,
  p_tax_cents integer,
  p_total_cents integer
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_session public.checkout_sessions%rowtype;
  v_payload jsonb;
  v_order jsonb;
  v_items jsonb;
  v_item jsonb;
  v_order_id uuid;
  v_tax_cents integer := greatest(coalesce(p_tax_cents,0),0);
  v_total_cents integer := greatest(coalesce(p_total_cents,0),0);
begin
  select * into v_session
  from public.checkout_sessions
  where id=p_session_id
  for update;

  if v_session.id is null then
    raise exception 'CHECKOUT_SESSION_NOT_FOUND';
  end if;

  if v_session.order_id is not null then
    return v_session.order_id;
  end if;

  if v_session.expires_at < now() then
    update public.checkout_sessions
      set status='expired',updated_at=now()
    where id=p_session_id;
    raise exception 'CHECKOUT_SESSION_EXPIRED';
  end if;

  v_payload := coalesce(v_session.payload,'{}'::jsonb);
  v_order := coalesce(v_payload->'order','{}'::jsonb);
  v_items := coalesce(v_payload->'items','[]'::jsonb);

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items)=0 then
    raise exception 'CHECKOUT_ITEMS_MISSING';
  end if;

  insert into public.orders(
    status,
    payment_status,
    payment_provider,
    fulfillment_type,
    currency,
    subtotal,
    discount_amount,
    tax_amount,
    delivery_amount,
    total_amount,
    subtotal_cents,
    delivery_cents,
    tax_cents,
    total_cents,
    customer_name,
    customer_email,
    customer_phone,
    delivery_address,
    delivery_apt,
    delivery_city,
    delivery_state,
    delivery_zip,
    delivery_zone,
    google_place_id,
    delivery_notes,
    checkout_environment,
    is_test,
    square_order_id,
    square_payment_link_id
  ) values (
    'pending_payment',
    'pending',
    'square',
    coalesce(nullif(v_order->>'fulfillment_type',''),'delivery'),
    'USD',
    coalesce((v_order->>'subtotal')::numeric,0),
    0,
    v_tax_cents::numeric/100,
    coalesce((v_order->>'delivery_amount')::numeric,0),
    v_total_cents::numeric/100,
    coalesce((v_order->>'subtotal_cents')::integer,0),
    coalesce((v_order->>'delivery_cents')::integer,0),
    v_tax_cents,
    v_total_cents,
    v_order->>'customer_name',
    lower(v_order->>'customer_email'),
    nullif(v_order->>'customer_phone',''),
    v_order->>'delivery_address',
    nullif(v_order->>'delivery_apt',''),
    v_order->>'delivery_city',
    v_order->>'delivery_state',
    v_order->>'delivery_zip',
    v_order->>'delivery_zone',
    nullif(v_order->>'google_place_id',''),
    nullif(v_order->>'delivery_notes',''),
    coalesce(nullif(v_order->>'checkout_environment',''),v_session.environment),
    coalesce((v_order->>'is_test')::boolean,true),
    p_square_order_id,
    v_session.square_payment_link_id
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    insert into public.order_items(
      order_id,
      product_id,
      sku,
      product_name,
      variant,
      variant_name,
      quantity,
      unit_price,
      line_total,
      unit_price_cents,
      line_total_cents,
      unit_cost_snapshot
    ) values (
      v_order_id,
      nullif(v_item->>'product_id','')::uuid,
      v_item->>'sku',
      v_item->>'product_name',
      nullif(v_item->>'variant',''),
      nullif(v_item->>'variant_name',''),
      coalesce((v_item->>'quantity')::numeric,0),
      coalesce((v_item->>'unit_price')::numeric,0),
      coalesce((v_item->>'line_total')::numeric,0),
      coalesce((v_item->>'unit_price_cents')::integer,0),
      coalesce((v_item->>'line_total_cents')::integer,0),
      coalesce((v_item->>'unit_cost_snapshot')::numeric,0)
    );
  end loop;

  update public.checkout_sessions
    set status='order_created',
        order_id=v_order_id,
        square_order_id=coalesce(p_square_order_id,square_order_id),
        updated_at=now()
  where id=p_session_id;

  return v_order_id;
end;
$$;

revoke all on function public.nurai_create_order_from_checkout_session(uuid,text,text,timestamptz,integer,integer) from public, anon, authenticated;
grant execute on function public.nurai_create_order_from_checkout_session(uuid,text,text,timestamptz,integer,integer) to service_role;

commit;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='checkout_sessions'
order by ordinal_position;
