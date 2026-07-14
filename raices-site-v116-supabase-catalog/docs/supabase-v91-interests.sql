-- Raíces v91 - Tabla para guardar newsletter, waitlist y carritos interesados
create extension if not exists pgcrypto;

create table if not exists public.raices_interests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text,
  status text default 'new',
  user_id uuid null,
  email text not null,
  name text,
  phone text,
  address text,
  apt text,
  city text,
  zip text,
  delivery_zone text,
  delivery_cost numeric(10,2),
  subtotal numeric(10,2),
  total numeric(10,2),
  cart jsonb,
  payload jsonb,
  language text
);

create index if not exists raices_interests_email_idx on public.raices_interests(email);
create index if not exists raices_interests_source_idx on public.raices_interests(source);
create index if not exists raices_interests_created_at_idx on public.raices_interests(created_at desc);

alter table public.raices_interests enable row level security;

-- No public select/insert policies are needed because writes happen via Netlify Function
-- using SUPABASE_SERVICE_ROLE_KEY. Keep this table private.
