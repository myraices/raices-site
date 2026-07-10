RAÍCES v103 — GOOGLE ADDRESS AUTOCOMPLETE

Included:
- Google Places autocomplete in My Account > Addresses.
- Automatic street, city, state, ZIP and country fields.
- Place ID, latitude, longitude and delivery notes saved in Supabase.
- ES/EN interface.

ONE REQUIRED STEP BEFORE UPLOADING:
1. Open js/google-maps-config.js
2. Replace PASTE_YOUR_RESTRICTED_GOOGLE_MAPS_API_KEY_HERE with the restricted browser key from Google Cloud.
3. Save the file, then upload/push the full project.

The key must be restricted to:
- Website: https://myraices.com/*
- APIs: Maps JavaScript API and Places API (New)

Supabase SQL:
The columns were already added during setup. The same idempotent SQL is included at:
supabase/customer_addresses_v103.sql
