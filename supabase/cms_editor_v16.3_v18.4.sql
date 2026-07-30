-- NURAI v16.3 + MyRaices v18.4
-- Ejecutar una sola vez. No elimina ni modifica artículos existentes.

-- La columna ya existe en instalaciones recientes; esto mantiene compatibilidad.
alter table public.blog_articles
  add column if not exists related_product_ids jsonb not null default '[]'::jsonb;

-- Bucket público para imágenes del CMS.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('blog-media','blog-media',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public reads blog media" on storage.objects;
create policy "Public reads blog media" on storage.objects
for select using (bucket_id='blog-media');

drop policy if exists "NURAI admins upload blog media" on storage.objects;
create policy "NURAI admins upload blog media" on storage.objects
for insert to authenticated with check (bucket_id='blog-media' and public.nurai_cms_is_admin());

drop policy if exists "NURAI admins update blog media" on storage.objects;
create policy "NURAI admins update blog media" on storage.objects
for update to authenticated using (bucket_id='blog-media' and public.nurai_cms_is_admin()) with check (bucket_id='blog-media' and public.nurai_cms_is_admin());

drop policy if exists "NURAI admins delete blog media" on storage.objects;
create policy "NURAI admins delete blog media" on storage.objects
for delete to authenticated using (bucket_id='blog-media' and public.nurai_cms_is_admin());

create or replace view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,
       a.author_name,a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,
       a.reading_time_minutes,a.published_at,a.seo_title_es,a.seo_title_en,
       a.seo_description_es,a.seo_description_en,a.related_product_ids,a.view_count,
       c.slug as category_slug,c.name_es as category_name_es,c.name_en as category_name_en
from public.blog_articles a
left join public.blog_categories c on c.id=a.category_id
where a.status='published' and a.published_at is not null and a.published_at<=now();

grant select on public.blog_articles_public to anon,authenticated;
