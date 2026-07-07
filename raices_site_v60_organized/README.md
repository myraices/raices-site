# Raíces Site

Sitio web de Raíces conectado a Netlify, Supabase, Brevo y preparado para Square Checkout.

## Estructura

- `index.html`: estructura principal de la página.
- `css/styles.css`: estilos visuales.
- `js/app.js`: idioma, navegación, menú móvil y acciones generales.
- `js/analytics.js`: eventos de Google Analytics.
- `js/auth.js`: login, registro, logout, recuperación de contraseña y estado del usuario.
- `assets/`: imágenes.
- `netlify/functions/`: funciones backend para Brevo y futuras funciones de Square.

## Próximas fases

1. Crear tablas de Supabase: `profiles`, `products`, `orders`, `order_items`.
2. Convertir el catálogo a datos dinámicos.
3. Crear carrito persistente.
4. Crear Netlify Function para Square Checkout.
5. Guardar pedidos y confirmaciones.
