-- MyRaices / NURAI v20.3 — product content fields
alter table public.products add column if not exists benefits_es jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists benefits_en jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists ingredients_text_es text;
alter table public.products add column if not exists ingredients_text_en text;
alter table public.products add column if not exists conservation_text_es text;
alter table public.products add column if not exists conservation_text_en text;
alter table public.products add column if not exists preparation_text_es text;
alter table public.products add column if not exists preparation_text_en text;
alter table public.products add column if not exists moment_text_es text;
alter table public.products add column if not exists moment_text_en text;
alter table public.products add column if not exists related_hint_es text;
alter table public.products add column if not exists related_hint_en text;

update public.products set
  benefits_es = case when benefits_es = '[]'::jsonb then coalesce(benefits, '[]'::jsonb) else benefits_es end,
  ingredients_text_es = coalesce(ingredients_text_es, ingredients_text),
  conservation_text_es = coalesce(conservation_text_es, conservation_text),
  preparation_text_es = coalesce(preparation_text_es, preparation_text),
  moment_text_es = coalesce(moment_text_es, moment_text),
  related_hint_es = coalesce(related_hint_es, related_hint)
where true;
