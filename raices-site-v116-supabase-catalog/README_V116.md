# Raíces Web v116 — Catálogo conectado a Supabase

## Qué cambia

- La web consulta `public.products` antes de iniciar la tienda.
- Los productos de Supabase con el mismo SKU reemplazan precio, nombre, imagen, stock y estado del catálogo estático.
- Los productos nuevos de Supabase se añaden cuando están `active` o `sold_out`.
- `draft`, `hidden` y `archived` no aparecen.
- Si Supabase falla, la web continúa con el catálogo estático.

## Estrategia temporal

Esta versión usa modo híbrido para no eliminar de la web los productos históricos que todavía no se han migrado al Admin. Cuando todo el catálogo esté en Supabase, se podrá retirar `js/products.js`.

## Antes de publicar

Ejecuta en Supabase SQL Editor:

`supabase/public_catalog_policy_v116.sql`
