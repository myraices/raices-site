# MyRaices v23.3 — Email Marketing Foundation

- Blog newsletter now requires explicit consent and Cloudflare Turnstile.
- Home, Blog and registered-user marketing are separated from waitlists and transactional emails.
- `marketing_subscribers` is the canonical consent table: one normalized email, language, source and status.
- Account/profile language changes can update an existing active subscriber but can never create consent.
- Waitlist contacts no longer receive `MARKETING_CONSENT=true` or automatic membership in the marketing list.
- Secure `marketing-profile-sync` links confirmed MyRaices accounts to prior explicit consent.
- `brevo-marketing-webhook` is ready to mirror unsubscribe/complaint events back to Supabase.
- Legacy Blog subscriptions are intentionally not backfilled because the old Blog form did not show an explicit checkbox.

## Required before validation
Run `supabase/marketing_subscribers_v23.3.sql` once in the shared Supabase project.

## Brevo next step
Configure the marketing list/attributes, one ES/EN welcome automation, and the webhook using `BREVO_MARKETING_WEBHOOK_SECRET`.
