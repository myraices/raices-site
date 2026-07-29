-- My Raíces Blog — Phase 1
create extension if not exists pgcrypto;

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_es text not null,
  name_en text,
  description_es text,
  description_en text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title_es text not null,
  title_en text,
  excerpt_es text,
  excerpt_en text,
  content_blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(content_blocks)='array'),
  category_id uuid references public.blog_categories(id) on delete set null,
  author_name text not null default 'Equipo My Raíces',
  hero_image_url text,
  hero_image_alt_es text,
  hero_image_alt_en text,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  featured boolean not null default false,
  reading_time_minutes integer check (reading_time_minutes is null or reading_time_minutes > 0),
  published_at timestamptz,
  scheduled_at timestamptz,
  seo_title_es text,
  seo_title_en text,
  seo_description_es text,
  seo_description_en text,
  related_product_ids jsonb not null default '[]'::jsonb,
  view_count bigint not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_articles_public_idx on public.blog_articles(status,published_at desc);
create index if not exists blog_articles_category_idx on public.blog_articles(category_id,published_at desc);

create or replace function public.set_blog_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists blog_categories_updated_at on public.blog_categories;
create trigger blog_categories_updated_at before update on public.blog_categories for each row execute function public.set_blog_updated_at();
drop trigger if exists blog_articles_updated_at on public.blog_articles;
create trigger blog_articles_updated_at before update on public.blog_articles for each row execute function public.set_blog_updated_at();

alter table public.blog_categories enable row level security;
alter table public.blog_articles enable row level security;

drop policy if exists "Public reads active blog categories" on public.blog_categories;
create policy "Public reads active blog categories" on public.blog_categories for select using (is_active=true);
drop policy if exists "Public reads published blog articles" on public.blog_articles;
create policy "Public reads published blog articles" on public.blog_articles for select using (status='published' and published_at<=now());

create or replace view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,
       a.author_name,a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,
       a.reading_time_minutes,a.published_at,a.seo_title_es,a.seo_title_en,
       a.seo_description_es,a.seo_description_en,a.related_product_ids,a.view_count,
       c.slug as category_slug,c.name_es as category_name_es,c.name_en as category_name_en
from public.blog_articles a left join public.blog_categories c on c.id=a.category_id
where a.status='published' and a.published_at<=now();
grant select on public.blog_articles_public to anon, authenticated;

insert into public.blog_categories(slug,name_es,name_en,sort_order) values
('nutricion','Nutrición','Nutrition',10),('bienestar','Bienestar','Wellness',20),
('recetas','Recetas','Recipes',30),('estilo-de-vida','Estilo de vida','Lifestyle',40),
('ingredientes','Ingredientes','Ingredients',50),('tes-e-infusiones','Tés e infusiones','Teas & infusions',60)
on conflict(slug) do update set name_es=excluded.name_es,name_en=excluded.name_en,sort_order=excluded.sort_order;
