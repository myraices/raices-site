-- NURAI v16.3.3 + MyRaices v18.4.1
-- Publicación programada sin cron: la vista pública hace visible el artículo al llegar scheduled_at.
-- Ejecutar una sola vez. No elimina ni altera contenido.

create or replace view public.blog_articles_public as
select a.id,a.slug,a.title_es,a.title_en,a.excerpt_es,a.excerpt_en,a.content_blocks,
       a.author_name,a.hero_image_url,a.hero_image_alt_es,a.hero_image_alt_en,a.featured,
       a.reading_time_minutes,
       case when a.status='scheduled' then a.scheduled_at else a.published_at end as published_at,
       a.seo_title_es,a.seo_title_en,a.seo_description_es,a.seo_description_en,
       a.related_product_ids,a.view_count,
       c.slug as category_slug,c.name_es as category_name_es,c.name_en as category_name_en
from public.blog_articles a
left join public.blog_categories c on c.id=a.category_id
where (a.status='published' and a.published_at is not null and a.published_at<=now())
   or (a.status='scheduled' and a.scheduled_at is not null and a.scheduled_at<=now());

grant select on public.blog_articles_public to anon,authenticated;
