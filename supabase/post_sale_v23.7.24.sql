-- NURAI / MyRaices v23.7.24 · Solicitudes postventa
-- Ejecutar una sola vez en Supabase SQL Editor antes de desplegar v23.7.24.

begin;

create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists manage_token uuid default gen_random_uuid(),
  add column if not exists cancellation_requested_at timestamptz;

update public.orders set manage_token=gen_random_uuid() where manage_token is null;
alter table public.orders alter column manage_token set not null;
create unique index if not exists orders_manage_token_uidx on public.orders(manage_token);

create table if not exists public.post_sale_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_email text,
  request_type text not null check (request_type in ('cancellation','home_return','issue')),
  status text not null default 'pending' check (status in (
    'pending','approved','awaiting_return','received','inspection','refund_approved',
    'refunded','replacement','rejected','closed','cancelled','expired'
  )),
  reason text,
  customer_note text,
  requested_amount numeric(12,2),
  approved_amount numeric(12,2),
  return_deadline date,
  received_at timestamptz,
  inspected_at timestamptz,
  resolution text,
  rejection_reason text,
  square_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_sale_requests_order_idx on public.post_sale_requests(order_id,created_at desc);
create index if not exists post_sale_requests_status_idx on public.post_sale_requests(status,created_at desc);

create table if not exists public.post_sale_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.post_sale_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  requested_amount numeric(12,2),
  created_at timestamptz not null default now(),
  unique(request_id, order_item_id)
);

create table if not exists public.post_sale_evidence (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.post_sale_requests(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_sale_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.post_sale_requests(id) on delete cascade,
  actor_type text not null default 'system' check (actor_type in ('customer','admin','system')),
  actor_user_id uuid,
  event_type text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists post_sale_events_request_idx on public.post_sale_events(request_id,created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-sale-evidence','post-sale-evidence',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.post_sale_requests enable row level security;
alter table public.post_sale_request_items enable row level security;
alter table public.post_sale_evidence enable row level security;
alter table public.post_sale_events enable row level security;

drop policy if exists post_sale_requests_admin_all on public.post_sale_requests;
create policy post_sale_requests_admin_all on public.post_sale_requests for all to authenticated
using(public.is_active_nurai_admin()) with check(public.is_active_nurai_admin());
drop policy if exists post_sale_items_admin_all on public.post_sale_request_items;
create policy post_sale_items_admin_all on public.post_sale_request_items for all to authenticated
using(public.is_active_nurai_admin()) with check(public.is_active_nurai_admin());
drop policy if exists post_sale_evidence_admin_all on public.post_sale_evidence;
create policy post_sale_evidence_admin_all on public.post_sale_evidence for all to authenticated
using(public.is_active_nurai_admin()) with check(public.is_active_nurai_admin());
drop policy if exists post_sale_events_admin_all on public.post_sale_events;
create policy post_sale_events_admin_all on public.post_sale_events for all to authenticated
using(public.is_active_nurai_admin()) with check(public.is_active_nurai_admin());

grant select,insert,update,delete on public.post_sale_requests to authenticated;
grant select,insert,update,delete on public.post_sale_request_items to authenticated;
grant select,insert,update,delete on public.post_sale_evidence to authenticated;
grant select,insert,update,delete on public.post_sale_events to authenticated;
grant usage,select on sequence public.post_sale_events_id_seq to authenticated;

-- Evidencias privadas: solo administradores NURAI pueden consultarlas directamente.
drop policy if exists post_sale_evidence_storage_admin_read on storage.objects;
create policy post_sale_evidence_storage_admin_read on storage.objects for select to authenticated
using(bucket_id='post-sale-evidence' and public.is_active_nurai_admin());

-- Mantener updated_at.
create or replace function public.touch_post_sale_request_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists touch_post_sale_request_updated_at_trigger on public.post_sale_requests;
create trigger touch_post_sale_request_updated_at_trigger before update on public.post_sale_requests
for each row execute function public.touch_post_sale_request_updated_at();

commit;
