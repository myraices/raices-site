create table if not exists public.stock_waitlist (
  id uuid primary key default gen_random_uuid(),
  product_id uuid null references public.products(id) on delete set null,
  sku text not null,
  product_name text not null,
  email text not null,
  name text null,
  language text not null default 'es',
  status text not null default 'pending' check (status in ('pending','notified','cancelled')),
  requested_at timestamptz not null default now(),
  notified_at timestamptz null,
  last_requested_at timestamptz not null default now(),
  source text not null default 'website',
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists stock_waitlist_pending_email_sku_uq
  on public.stock_waitlist (lower(email), sku) where status='pending';
create index if not exists stock_waitlist_sku_status_idx on public.stock_waitlist(sku,status);
alter table public.stock_waitlist enable row level security;
drop policy if exists "nurai admins read stock waitlist" on public.stock_waitlist;
create policy "nurai admins read stock waitlist" on public.stock_waitlist for select to authenticated using (public.is_active_nurai_admin());
comment on table public.stock_waitlist is 'Solicitudes Avisarme por producto. v7.2';
