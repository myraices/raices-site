# Raíces Site v61 — Arquitectura de tienda por colecciones

Esta versión reorganiza la web alrededor de las líneas principales de Raíces:

- Kitchen
- Herbal
- Desserts
- Home
- Wellness
- Naturals queda reservado como próxima línea.

## Incluye

- Nueva home editorial.
- Tienda por categorías y colecciones.
- Productos cargados desde `js/products.js` usando el Master Catalog.
- Carrito local preliminar con subtotal.
- Auth de Supabase preservado.
- Newsletter y WhatsApp preservados.

## Aún no incluye

- Square Checkout final.
- Delivery/taxes automáticos.
- Guardado de pedidos en Supabase.

Es la base visual y de arquitectura antes de conectar checkout y pedidos.


## v80 - Catálogo centralizado

Esta versión agrega `js/catalog.js` como capa única para leer productos, categorías y colecciones.

A partir de esta versión, las próximas fases deben usar `window.RAICES_CATALOG` para:

- Buscar productos por SKU.
- Generar líneas de carrito.
- Filtrar por categoría o colección.
- Preparar checkout con Square.
- Guardar pedidos en Supabase.

La apariencia visual de la web no cambia en esta versión; el cambio es estructural.


## v81
- Carrito lateral completo con miniaturas, variantes, cantidades, eliminar producto y subtotal dinámico.
- Persistencia en localStorage.
- Checkout queda desactivado para la siguiente fase de delivery/Square.

## v82 - Delivery por ZIP Code

- Agregado cálculo de delivery en el carrito lateral.
- No hay pickup.
- Katy / Cinco Ranch: $5.
- Fulshear / Richmond: $8.
- Houston / Sugar Land / Cypress: $15.
- Fuera de zona: mensaje para contactar por WhatsApp.
- Total del carrito ahora suma subtotal + delivery.


## v83 Delivery ZIP fix
- Delivery validates immediately when the 5-digit ZIP is entered.
- Apply button now forces update even when cart is empty.
- Valid ZIP shows zone and cost clearly before checkout.

## v84 — Delivery integrado al carrito
- El ZIP genera un estado de delivery persistente en `localStorage`.
- El costo de delivery se suma al total del carrito cuando hay productos y ZIP válido.
- Se guarda un resumen en `raices_cart_summary` para la próxima fase de checkout/Square.
- Checkout queda preparado, pero el pago real se activará en la siguiente fase.

## v85 - Datos de entrega
- Se agregaron campos de nombre, teléfono, dirección, ciudad, apt/suite e instrucciones de entrega dentro del carrito.
- Los datos se guardan localmente para preparar la integración con Supabase y Square.
- El checkout ahora requiere carrito + ZIP válido + datos obligatorios de entrega.

## v86
- Compacta el carrito lateral para dar más espacio a los productos.
- Entrega y datos de entrega ahora están en bloques colapsables.
- Resumen de subtotal/delivery/total queda fijo y compacto al final.


## v88 Checkout en modo lista de espera
- No se aceptan pagos ni pedidos reales.
- El botón del carrito abre una lista de espera.
- La lista usa la función existente de Brevo para guardar el email.
- El carrito, delivery y datos se conservan para futuras fases de Square.


## v91 - Supabase intereses y carritos

Esta versión agrega `netlify/functions/save-interest.js` y `docs/supabase-v91-interests.sql`.

Antes de probar en producción:
1. Ejecutar el SQL de `docs/supabase-v91-interests.sql` en Supabase SQL Editor.
2. Crear en Netlify la variable `SUPABASE_SERVICE_ROLE_KEY` con la service role key de Supabase.
3. Verificar que `SUPABASE_URL` exista o usar la URL incluida por defecto.

Se guardan en Supabase:
- Suscripciones de newsletter (`source = newsletter_section`).
- Interesados del checkout/lista de espera (`source = checkout_waitlist`).
- Carrito, delivery, datos de entrega, subtotal y total cuando existen.

Brevo sigue siendo la fuente para newsletters y campañas. Supabase queda como base operativa de clientes/intereses/pedidos futuros.


## v92 Supabase Fase 1
- El formulario de newsletter y el modal de lista de espera guardan primero en Supabase (`raices_interests`).
- Brevo se intenta después en segundo plano, para que un problema de Brevo no impida guardar el lead.
- `save-interest` acepta `VITE_SUPABASE_URL` o `SUPABASE_URL` y usa `SUPABASE_SERVICE_ROLE_KEY`.

Prueba: agregar producto + ZIP + datos de entrega + Join waitlist. Luego revisar Supabase > Table Editor > `raices_interests`.
