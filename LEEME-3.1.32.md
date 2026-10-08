# MyRaices 3.1.32 — idioma de fichas y colecciones

Desplegar esta carpeta en el proyecto Netlify de MyRaices, con el build existente `python3 scripts/build.py` y la carpeta publicada `dist`. Conserva tus variables actuales de entorno. Es una versión completa, con las mejoras de 3.1.31 incluidas. No hace falta actualizar NURAI 23.9.35 ni ejecutar otra migración SQL por esta corrección.

## Corrección

La versión 3.1.31 renderizaba todas las fichas y colecciones nuevas en español, aunque la tienda estuviera en inglés. La versión 3.1.32:

- Genera contenido ES/EN en el servidor desde los campos de idioma del producto en NURAI: nombre, descripción, características, ingredientes, conservación, preparación y opciones.
- Traduce navegación, botones, estados, presentación, avisos de digital y footer.
- Conserva el idioma al entrar desde la tienda, al navegar por colecciones/variantes y al volver para comprar.
- Incluye selector ES/EN en las fichas y colecciones.
- Respeta el idioma declarado en la URL y la preferencia guardada para enlaces antiguos sin idioma; evita ciclos de redirección.
- Genera título, descripción, datos estructurados y metadatos sociales en el idioma seleccionado; incorpora alternativos hreflang y URLs ES/EN en el sitemap.
- Conserva precio, stock, logística, presentación, galería y datos del producto.

Las URL de inglés usan `?lang=en`. Las URL españolas sin parámetro siguen funcionando; `?lang=es` fuerza español. No se cambian los slugs.

Si un campo de producto no tiene traducción inglesa guardada, se conserva el español como respaldo. La corrección no inventa traducciones ni escribe sobre tus registros. Si eso ocurre en un producto concreto, revisa su versión inglesa en NURAI y vuelve a publicarlo para generar/verificar la traducción.

## Validación

15 pruebas del sitio aprobadas (7 específicas de idioma), más las 5 de verificación pública de NURAI anterior: 20 en conjunto. Build y empaquetado de funciones correctos. Comprobados ES/EN en HTML, metadatos, colecciones, conservación del idioma, selector, retorno a compra y ausencia de ciclos en pruebas simuladas. No se desplegó ni se realizó una comprobación visual en navegador en este entorno.

Después de desplegar: selecciona EN en la tienda, entra a cualquier producto, comprueba sus textos y pulsa comprar. Debe volver a la tienda en EN con ese producto abierto. Cambia ES/EN desde la ficha y prueba también una colección.
