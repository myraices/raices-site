-- NURAI v16.1 + MyRaices v18.2 — verificación de sincronización
-- Seguro de ejecutar después de content_cms_v16.sql.
create or replace view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,
       a.author_name,a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,
       a.reading_time_minutes,a.published_at,a.seo_title_es,a.seo_title_en,
       a.seo_description_es,a.seo_description_en,a.related_product_ids,a.view_count,
       c.slug as category_slug,c.name_es as category_name_es,c.name_en as category_name_en
from public.blog_articles a
left join public.blog_categories c on c.id=a.category_id
where a.status='published' and a.published_at is not null and a.published_at<=now();
grant select on public.blog_articles_public to anon, authenticated;

-- Convierte bloques simples heredados de NURAI v16.0 al formato bilingüe público.
update public.blog_articles a
set content_blocks = coalesce((
  select jsonb_agg(
    case
      when elem ? 'text_es' or elem ? 'text_en' then elem
      when elem->>'lang'='en' then (elem - 'lang' - 'text' - 'content') || jsonb_build_object('text_en',coalesce(elem->>'text',elem->>'content',''))
      else (elem - 'lang' - 'text' - 'content') || jsonb_build_object('text_es',coalesce(elem->>'text',elem->>'content',''))
    end
  )
  from jsonb_array_elements(a.content_blocks) elem
), '[]'::jsonb)
where jsonb_typeof(a.content_blocks)='array'
  and exists (select 1 from jsonb_array_elements(a.content_blocks) e where e ? 'lang' or e ? 'text' or e ? 'content');
