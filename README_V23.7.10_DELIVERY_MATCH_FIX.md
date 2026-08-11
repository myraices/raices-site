# MyRaices v23.7.10 — Delivery coverage matching fix

- Robust normalization for delivery zones coming from NURAI/Supabase.
- Accepts ZIP coverage stored as strings or arrays and supports zips, zip_codes, zipCodes, coverage, prefixes and prefix aliases.
- ZIP/prefix normalization is applied consistently in public delivery config, cart/checkout UI, and Square checkout backend.
- Keeps NURAI/Supabase as the single source of truth; no hard-coded delivery zones were reintroduced.
- Taxes and Square Production remain unchanged.
