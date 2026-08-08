# MyRaíces v18.7.2 — Mobile CMS collection images

- Corrige las tarjetas de “Compra según tu momento” de la experiencia móvil vertical.
- Kitchen, Herbal, Desserts y Wellness ahora usan `window.RAICES_CATEGORIES[cat].image`, la misma fuente actualizada por NURAI → Contenido Web.
- Escucha `raices:siteContentUpdated` para refrescar las imágenes cuando el contenido CMS termina de cargar de forma asíncrona.
- Mantiene fallbacks locales si una imagen CMS no está disponible.
- Actualiza el cache-busting de `app-experience.js` a `v=18.7.2`.
- No modifica NURAI, Supabase, catálogo, carrito, checkout ni la Home desktop.
