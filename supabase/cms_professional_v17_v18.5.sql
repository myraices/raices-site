-- NURAI v17.0 + MyRaices v18.5 Professional CMS
-- Ejecutar una sola vez. Conserva todo el contenido existente.

alter table public.blog_articles add column if not exists expires_at timestamptz;
alter table public.blog_articles add column if not exists tags text[] not null default '{}';

create table if not exists public.blog_article_versions (
 id uuid primary key default gen_random_uuid(),
 article_id uuid not null references public.blog_articles(id) on delete cascade,
 snapshot jsonb not null,
 created_by uuid null,
 created_at timestamptz not null default now()
);
create index if not exists idx_blog_article_versions_article on public.blog_article_versions(article_id,created_at desc);
alter table public.blog_article_versions enable row level security;
drop policy if exists "cms versions authenticated" on public.blog_article_versions;
create policy "cms versions authenticated" on public.blog_article_versions for all to authenticated using (true) with check (true);

create or replace view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,
 a.author_name,a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,a.reading_time_minutes,
 case when a.status='scheduled' then a.scheduled_at else a.published_at end as published_at,
 a.expires_at,a.tags,a.seo_title_es,a.seo_title_en,a.seo_description_es,a.seo_description_en,
 a.related_product_ids,a.view_count,c.slug as category_slug,c.name_es as category_name_es,c.name_en as category_name_en
from public.blog_articles a left join public.blog_categories c on c.id=a.category_id
where (((a.status='published' and a.published_at is not null and a.published_at<=now())
 or (a.status='scheduled' and a.scheduled_at is not null and a.scheduled_at<=now()))
 and (a.expires_at is null or a.expires_at>now()));
grant select on public.blog_articles_public to anon,authenticated;
