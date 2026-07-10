-- Raíces v103 — Google address data and delivery notes
alter table public.customer_addresses
  add column if not exists place_id text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists delivery_notes text;
