-- NURAI v20 · Product web card fields
-- Run once in Supabase SQL Editor before using the new fields.
alter table public.products add column if not exists card_description_es text;
alter table public.products add column if not exists card_description_en text;
alter table public.products add column if not exists badge_es text;
alter table public.products add column if not exists badge_en text;
alter table public.products add column if not exists compare_at_price numeric(10,2);
alter table public.products add column if not exists card_cta_es text;
alter table public.products add column if not exists card_cta_en text;
alter table public.products add column if not exists image_position text default 'center';

alter table public.products drop constraint if exists products_image_position_check;
alter table public.products add constraint products_image_position_check
check (image_position is null or image_position in ('center','top','bottom','left','right'));
