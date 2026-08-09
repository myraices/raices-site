-- NURAI / MyRaices v23.6.0 — Blog Audio ES/EN
-- Ejecutar una sola vez en Supabase SQL Editor antes de usar “Generar audio”.
begin;

alter table public.blog_articles
  add column if not exists audio_url_es text,
  add column if not exists audio_url_en text,
  add column if not exists audio_source_hash_es text,
  add column if not exists audio_source_hash_en text,
  add column if not exists audio_generated_at_es timestamptz,
  add column if not exists audio_generated_at_en timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-audio', 'blog-audio', true, 52428800, array['audio/mpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop view if exists public.blog_articles_public;
create view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,a.author_name,
 a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,a.reading_time_minutes,
 case when a.status='scheduled' then a.scheduled_at else a.published_at end as published_at,
 a.expires_at,a.tags,a.tags_en,a.seo_title_es,a.seo_title_en,a.seo_description_es,a.seo_description_en,
 a.related_product_ids,a.view_count,
 a.audio_url_es,a.audio_url_en,a.audio_source_hash_es,a.audio_source_hash_en,a.audio_generated_at_es,a.audio_generated_at_en,
 c.slug category_slug,c.name_es category_name_es,c.name_en category_name_en
from public.blog_articles a left join public.blog_categories c on c.id=a.category_id
where (((a.status='published' and a.published_at is not null and a.published_at<=now()) or
        (a.status='scheduled' and a.scheduled_at is not null and a.scheduled_at<=now())))
  and (a.expires_at is null or a.expires_at>now());

grant select on public.blog_articles_public to anon, authenticated;
commit;
