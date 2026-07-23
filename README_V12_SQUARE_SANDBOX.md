# MyRaices v12.1 — Square Sandbox

Correcciones incluidas:
- Los productos digitales de The Library no cobran delivery ni requieren dirección.
- En carritos mixtos, el delivery y el umbral gratis se calculan solo con productos físicos.
- Se corrigió la versión de Square API a `2026-07-15`.
- Se eliminó el teléfono prellenado en Square Checkout para evitar rechazos por formato.
- Los errores de Square muestran más detalle durante Sandbox.

Esta versión añade un checkout alojado por Square y conserva la tienda en preapertura.

## Antes de probar
1. Ejecutar `supabase/orders_square_v12.sql` en Supabase SQL Editor.
2. En Netlify confirmar las variables:
   - `SQUARE_ENVIRONMENT=sandbox`
   - `SQUARE_ACCESS_TOKEN` (Sandbox)
   - `SQUARE_LOCATION_ID` (Sandbox)
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Hacer deploy.
4. En Square Developer > Webhooks > Sandbox, crear la suscripción:
   - URL: `https://myraices.com/.netlify/functions/square-webhook`
   - Eventos: `payment.created` y `payment.updated`
5. Copiar la Signature Key a `SQUARE_WEBHOOK_SIGNATURE_KEY` en Netlify y redeploy.

## Seguridad de lanzamiento
- En Sandbox no hay cargos reales.
- Production queda bloqueado mientras `SQUARE_SALES_ENABLED` no sea `true`.
- Antes de Live hay que definir impuestos, completar cocina/empaques y sustituir todas las credenciales por Production.
- Los importes se recalculan en Netlify desde `data/products.json`; el navegador no decide precios.