-- Raíces Web v116
-- Visitors may read products shown in the public catalog.
-- Product management remains restricted by the existing admin policy.

drop policy if exists "Anyone can read active products"
on public.products;

drop policy if exists "Public can read storefront products"
on public.products;

create policy "Public can read storefront products"
on public.products
for select
to anon, authenticated
using (status in ('active', 'sold_out'));
