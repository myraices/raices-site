RAÍCES v105 — NETLIFY GOOGLE MAPS KEY INJECTION

This version removes the real Google Maps key from the GitHub repository.

Required Netlify setting before the deploy can succeed:
1. Site configuration > Environment variables
2. Add GOOGLE_MAPS_API_KEY with the restricted Google Maps browser key
3. Save and trigger a new deploy

The build command in netlify.toml creates /dist and injects the key only during
Netlify's build. The repository keeps only a placeholder.

Important: Google Maps browser keys are visible to visitors by design. Keep the
key restricted in Google Cloud to the allowed website referrers and only the
Maps JavaScript API / Places API services.
