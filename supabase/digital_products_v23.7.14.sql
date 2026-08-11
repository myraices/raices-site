-- NURAI v23.7.14 / MyRaices v23.7.14 — entrega segura de productos digitales
-- Ejecutar una sola vez en Supabase SQL Editor antes de usar la nueva función.

alter table public.products
  add column if not exists digital_file_path text,
  add column if not exists digital_file_name text,
  add column if not exists digital_file_size bigint;

alter table public.products drop constraint if exists products_tax_status_check;
alter table public.products add constraint products_tax_status_check
  check (tax_status in ('food_exempt','physical_taxable','digital_taxable','digital_review'));

update public.products
set tax_status = 'digital_taxable', taxable = true
where (coalesce(product_type,'') = 'digital' or coalesce(operational_type,'') = 'digital')
  and coalesce(tax_status,'digital_review') = 'digital_review';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digital-products','digital-products',false,52428800,array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "NURAI admins read digital products" on storage.objects;
drop policy if exists "NURAI admins upload digital products" on storage.objects;
drop policy if exists "NURAI admins update digital products" on storage.objects;
drop policy if exists "NURAI admins delete digital products" on storage.objects;
create policy "NURAI admins read digital products" on storage.objects for select to authenticated
using (bucket_id='digital-products' and public.is_raices_admin());
create policy "NURAI admins upload digital products" on storage.objects for insert to authenticated
with check (bucket_id='digital-products' and public.is_raices_admin());
create policy "NURAI admins update digital products" on storage.objects for update to authenticated
using (bucket_id='digital-products' and public.is_raices_admin()) with check (bucket_id='digital-products' and public.is_raices_admin());
create policy "NURAI admins delete digital products" on storage.objects for delete to authenticated
using (bucket_id='digital-products' and public.is_raices_admin());

create table if not exists public.digital_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  customer_email text not null,
  download_token uuid not null default gen_random_uuid(),
  download_count integer not null default 0,
  last_download_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id, product_id),
  unique(download_token)
);
alter table public.digital_entitlements enable row level security;
revoke all on table public.digital_entitlements from anon, authenticated;

-- Update RPC used by NURAI so tax/file metadata is persisted together with the product.
create or replace function public.nurai_update_product(p_product_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_current public.products%rowtype; v_next public.products%rowtype; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if not exists (select 1 from public.admin_users a where a.user_id=auth.uid() and coalesce(a.is_active,true)=true and a.role in ('administrator','admin','owner')) then raise exception 'No tienes permiso para modificar productos'; end if;
  select * into v_current from public.products where id=p_product_id;
  if not found then raise exception 'Producto no encontrado'; end if;
  select * into v_next from jsonb_populate_record(v_current,coalesce(p_payload,'{}'::jsonb));
  update public.products set
    sku=v_next.sku,name_es=v_next.name_es,name_en=v_next.name_en,description_es=v_next.description_es,description_en=v_next.description_en,
    long_description_es=v_next.long_description_es,long_description_en=v_next.long_description_en,benefits=v_next.benefits,benefits_es=v_next.benefits_es,benefits_en=v_next.benefits_en,
    ingredients_text=v_next.ingredients_text,ingredients_text_es=v_next.ingredients_text_es,ingredients_text_en=v_next.ingredients_text_en,
    conservation_text=v_next.conservation_text,conservation_text_es=v_next.conservation_text_es,conservation_text_en=v_next.conservation_text_en,
    preparation_text=v_next.preparation_text,preparation_text_es=v_next.preparation_text_es,preparation_text_en=v_next.preparation_text_en,
    moment_text=v_next.moment_text,moment_text_es=v_next.moment_text_es,moment_text_en=v_next.moment_text_en,
    related_hint=v_next.related_hint,related_hint_es=v_next.related_hint_es,related_hint_en=v_next.related_hint_en,
    card_description_es=v_next.card_description_es,card_description_en=v_next.card_description_en,badge_es=v_next.badge_es,badge_en=v_next.badge_en,
    compare_at_price=v_next.compare_at_price,card_cta_es=v_next.card_cta_es,card_cta_en=v_next.card_cta_en,image_position=v_next.image_position,
    collection=v_next.collection,category=v_next.category,price=v_next.price,unit_price=v_next.unit_price,units_per_pack=v_next.units_per_pack,
    weight_value=v_next.weight_value,weight_unit=v_next.weight_unit,stock=v_next.stock,minimum_stock=v_next.minimum_stock,ideal_stock=v_next.ideal_stock,
    production_cost=v_next.production_cost,packaging_cost=v_next.packaging_cost,slug=v_next.slug,meta_title=v_next.meta_title,meta_description=v_next.meta_description,
    tags=v_next.tags,related_products=v_next.related_products,status=v_next.status,featured=v_next.featured,image_url=v_next.image_url,sort_order=v_next.sort_order,
    product_type=v_next.product_type,tax_status=v_next.tax_status,taxable=v_next.taxable,fulfillment_type=v_next.fulfillment_type,storage_type=v_next.storage_type,
    shipping_profile=v_next.shipping_profile,shelf_life_days=v_next.shelf_life_days,warehouse_location=v_next.warehouse_location,barcode=v_next.barcode,
    shipping_weight_value=v_next.shipping_weight_value,shipping_weight_unit=v_next.shipping_weight_unit,lead_time_days=v_next.lead_time_days,
    operational_type=v_next.operational_type,is_inventory_tracked=v_next.is_inventory_tracked,requires_cold_pack=v_next.requires_cold_pack,is_manufactured=v_next.is_manufactured,
    standard_batch_size=v_next.standard_batch_size,production_time_minutes=v_next.production_time_minutes,logistics_cost=v_next.logistics_cost,target_margin_percent=v_next.target_margin_percent,
    digital_file_path=v_next.digital_file_path,digital_file_name=v_next.digital_file_name,digital_file_size=v_next.digital_file_size,updated_at=now()
  where id=p_product_id returning to_jsonb(products.*) into v_result;
  if v_result is null then raise exception 'No se pudo confirmar la actualización del producto'; end if;
  return v_result;
end; $$;
revoke all on function public.nurai_update_product(uuid,jsonb) from public;
grant execute on function public.nurai_update_product(uuid,jsonb) to authenticated;
