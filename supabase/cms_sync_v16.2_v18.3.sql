-- NURAI v16.2 + MyRaices v18.3
-- Sincronización definitiva del CMS y migración del contenido visible del Blog a Supabase.
-- Puede ejecutarse varias veces sin duplicar artículos.

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

create or replace function public.set_blog_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists blog_categories_updated_at on public.blog_categories;
create trigger blog_categories_updated_at before update on public.blog_categories for each row execute function public.set_blog_updated_at();
drop trigger if exists blog_articles_updated_at on public.blog_articles;
create trigger blog_articles_updated_at before update on public.blog_articles for each row execute function public.set_blog_updated_at();

create or replace function public.nurai_cms_is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.admin_users a
    where a.user_id=auth.uid()
      and coalesce(a.is_active,true)=true
      and a.role in ('administrator','admin','owner')
  );
$$;

alter table public.blog_categories enable row level security;
alter table public.blog_articles enable row level security;

drop policy if exists "Public reads active blog categories" on public.blog_categories;
create policy "Public reads active blog categories" on public.blog_categories
for select using(is_active=true or public.nurai_cms_is_admin());
drop policy if exists "NURAI admins manage blog categories" on public.blog_categories;
create policy "NURAI admins manage blog categories" on public.blog_categories
for all to authenticated using(public.nurai_cms_is_admin()) with check(public.nurai_cms_is_admin());

drop policy if exists "Public reads published blog articles" on public.blog_articles;
create policy "Public reads published blog articles" on public.blog_articles
for select using((status='published' and published_at is not null and published_at<=now()) or public.nurai_cms_is_admin());
drop policy if exists "NURAI admins manage blog articles" on public.blog_articles;
create policy "NURAI admins manage blog articles" on public.blog_articles
for all to authenticated using(public.nurai_cms_is_admin()) with check(public.nurai_cms_is_admin());

insert into public.blog_categories(slug,name_es,name_en,sort_order,is_active) values
('nutricion','Nutrición','Nutrition',10,true),
('bienestar','Bienestar','Wellness',20,true),
('recetas','Recetas','Recipes',30,true),
('estilo-de-vida','Estilo de vida','Lifestyle',40,true),
('ingredientes','Ingredientes','Ingredients',50,true),
('tes-e-infusiones','Tés e infusiones','Teas & infusions',60,true)
on conflict(slug) do update set
  name_es=excluded.name_es,name_en=excluded.name_en,sort_order=excluded.sort_order,is_active=true;

-- Convierte en contenido real los seis artículos que formaban la portada inicial del Blog.
-- ON CONFLICT conserva cualquier edición posterior hecha por Yoly en NURAI.
insert into public.blog_articles
(slug,title_es,title_en,excerpt_es,excerpt_en,content_blocks,category_id,author_name,hero_image_url,status,featured,reading_time_minutes,published_at)
values
('alimentacion-real-camino-mejor-version','Alimentación real: el camino hacia tu mejor versión','Real food: the path to your best self','Descubre por qué volver a lo esencial en nuestra alimentación puede transformar tu energía, tu cuerpo y tu mente.','Discover why returning to essentials can transform your energy, body and mind.',
 '[{"type":"paragraph","text_es":"Alimentarnos de forma consciente no significa perseguir la perfección. Significa reconocer los ingredientes, escuchar al cuerpo y construir hábitos sostenibles."},{"type":"heading","level":2,"text_es":"Volver a lo esencial"},{"type":"paragraph","text_es":"La comida real nos conecta con sabores, texturas y preparaciones que forman parte de nuestra historia."},{"type":"quote","text_es":"El bienestar no comienza con una regla rígida, sino con una decisión cotidiana."}]'::jsonb,
 (select id from public.blog_categories where slug='nutricion'),'Equipo My Raíces','/assets/arepas-board.webp','published',true,6,'2026-07-26T12:00:00Z'),
('beneficios-tes-herbales','Los beneficios de los tés herbales en tu día a día','The benefits of herbal teas in your day','Una pausa sencilla puede convertirse en un ritual de energía, balance o calma.','A simple pause can become a ritual of energy, balance or calm.',
 '[{"type":"paragraph","text_es":"Una infusión puede ayudarte a crear una pausa consciente en medio del día."}]'::jsonb,
 (select id from public.blog_categories where slug='tes-e-infusiones'),'Equipo My Raíces','/assets/herbal-board.webp','published',true,4,'2026-07-21T12:00:00Z'),
('practicas-diarias-reducir-estres','5 prácticas diarias para reducir el estrés','5 daily practices to reduce stress','Pequeños hábitos que pueden ayudarte a recuperar presencia y equilibrio.','Small habits that can help you regain presence and balance.',
 '[{"type":"paragraph","text_es":"Respirar, caminar, descansar y comer con atención son prácticas sencillas que merecen espacio."}]'::jsonb,
 (select id from public.blog_categories where slug='bienestar'),'Equipo My Raíces','/assets/hero-hand-plant.webp','published',true,5,'2026-07-18T12:00:00Z'),
('curcuma-oro-naturaleza','Cúrcuma: el oro de la naturaleza','Turmeric: nature’s gold','Conoce esta raíz milenaria y algunas formas sencillas de incorporarla a tu rutina.','Learn about this ancient root and simple ways to add it to your routine.',
 '[{"type":"paragraph","text_es":"La cúrcuma aporta color, aroma y una historia culinaria que atraviesa generaciones."}]'::jsonb,
 (select id from public.blog_categories where slug='ingredientes'),'Equipo My Raíces','/assets/arepa-curcuma.webp','published',false,5,'2026-07-14T12:00:00Z'),
('rutinas-vida-consciente','Rutinas simples para una vida más consciente','Simple routines for a more mindful life','Pequeños cambios diarios que generan grandes transformaciones.','Small daily changes that create meaningful transformations.',
 '[{"type":"paragraph","text_es":"La constancia nace cuando una rutina cabe de verdad en nuestra vida."}]'::jsonb,
 (select id from public.blog_categories where slug='estilo-de-vida'),'Equipo My Raíces','/assets/home-board.webp','published',false,4,'2026-07-10T12:00:00Z'),
('arepas-yuca-curcuma','Arepas de yuca y cúrcuma: sabor que nutre','Cassava and turmeric arepas','Una forma deliciosa de llevar ingredientes esenciales a la mesa familiar.','A delicious way to bring essential ingredients to the family table.',
 '[{"type":"paragraph","text_es":"La yuca y la cúrcuma crean una combinación de sabor, color y versatilidad."}]'::jsonb,
 (select id from public.blog_categories where slug='recetas'),'Equipo My Raíces','/assets/arepa-curcuma.webp','published',false,6,'2026-07-06T12:00:00Z')
on conflict(slug) do nothing;

create index if not exists blog_articles_public_idx on public.blog_articles(status,published_at desc);
create index if not exists blog_articles_category_idx on public.blog_articles(category_id,published_at desc);

create or replace view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,
       a.author_name,a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,
       a.reading_time_minutes,a.published_at,a.seo_title_es,a.seo_title_en,
       a.seo_description_es,a.seo_description_en,a.related_product_ids,a.view_count,
       c.slug as category_slug,c.name_es as category_name_es,c.name_en as category_name_en
from public.blog_articles a
left join public.blog_categories c on c.id=a.category_id
where a.status='published' and a.published_at is not null and a.published_at<=now();

grant usage on schema public to anon,authenticated;
grant select on public.blog_articles_public to anon,authenticated;
grant select on public.blog_categories to anon,authenticated;
grant select,insert,update,delete on public.blog_articles to authenticated;
grant select,insert,update,delete on public.blog_categories to authenticated;
