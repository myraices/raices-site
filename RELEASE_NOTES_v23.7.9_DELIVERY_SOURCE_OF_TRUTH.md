# Raíces v23.7.9 — Delivery source of truth

- Delivery zones are now read from NURAI `nurai_settings.operation.delivery_zones` through Supabase.
- Added `/.netlify/functions/delivery-config` for sanitized public delivery coverage.
- Cart and checkout preview no longer depend on hard-coded delivery zones.
- Server-side Square checkout revalidates the delivery zone and fee from NURAI/Supabase before creating the order.
- Product `tax_status` is carried into checkout validation for audit/readiness, but no tax rate is calculated or applied yet.
- Square remains Sandbox/disabled for production until tax calculation is finalized and tested.
