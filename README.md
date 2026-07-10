# Raíces v112 — LOCALE sync

- Saves the preferred language in Supabase user metadata and localStorage.
- Updates Brevo contact attribute `LOCALE` with `es` or `en` when preferences change.
- Also sends `LOCALE` on signup/login/contact synchronization.
- Brevo failures do not block the user experience.

Requires a Brevo contact attribute named `LOCALE` with type Text.
