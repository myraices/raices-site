# MyRaíces v14.0.2 — Favorites Click Fix

Corrección puntual del botón de Favoritos.

## Causa
El listener global del botón estaba fuera del alcance de la función `toggleFavorite`, provocando un error al tocar el corazón.

## Corrección
El listener se movió dentro de la inicialización de la tienda, donde puede acceder correctamente a `toggleFavorite`.

## Resultado esperado
- Tocar ♡ cambia a ♥.
- Volver a tocar ♥ lo elimina.
- La selección persiste en el navegador.
- Los productos seleccionados aparecen en Mi Cuenta > Favoritos.
