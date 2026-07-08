# Raíces Catalog Architecture (v80)

`js/products.js` contiene los productos.
`js/site-config.js` contiene categorías y colecciones.
`js/catalog.js` crea `window.RAICES_CATALOG`, que será la fuente de lectura para carrito, checkout y pedidos.

## Flujo recomendado

Producto en catálogo → tarjeta de tienda → ficha → carrito → Square → Supabase orders.

## Regla

No duplicar nombres, precios o imágenes en otros archivos. Todo debe salir del catálogo.
