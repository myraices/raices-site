# MyRaíces 3.1.29 — Shipping Customer Data Validation

- Mantiene el nombre como requisito para calcular Shipping.
- Antes de llamar a Shippo, valida nombre, dirección, ciudad, estado y ZIP.
- Si falta información, muestra qué campos debe completar el cliente.
- Evita presentar un fallo genérico de Shippo cuando el problema son datos incompletos.
- El backend conserva la validación estricta y devuelve solo los nombres de campos faltantes para diagnóstico.
