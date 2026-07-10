-- Raíces v102 — multiple delivery addresses per customer
create extension if not exists pgcrypto;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'US',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_id_idx on public.customer_addresses(user_id);
create unique index if not exists customer_addresses_one_default_per_user
  on public.customer_addresses(user_id)
  where is_default = true;

alter table public.customer_addresses enable row level security;

drop policy if exists "Customers can read own addresses" on public.customer_addresses;
create policy "Customers can read own addresses" on public.customer_addresses
  for select using (auth.uid() = user_id);

drop policy if exists "Customers can add own addresses" on public.customer_addresses;
create policy "Customers can add own addresses" on public.customer_addresses
  for insert with check (auth.uid() = user_id);

drop policy if exists "Customers can update own addresses" on public.customer_addresses;
create policy "Customers can update own addresses" on public.customer_addresses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Customers can delete own addresses" on public.customer_addresses;
create policy "Customers can delete own addresses" on public.customer_addresses
  for delete using (auth.uid() = user_id);

create or replace function public.set_customer_address_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_addresses_updated_at on public.customer_addresses;
create trigger customer_addresses_updated_at
before update on public.customer_addresses
for each row execute function public.set_customer_address_updated_at();
