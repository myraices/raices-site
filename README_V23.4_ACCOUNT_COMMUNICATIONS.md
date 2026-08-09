# MyRaices v23.4 — Account Communications

## Included
- `Mi Cuenta > Preferencias` now shows the customer's current marketing subscription status.
- Customers who did not opt in during signup can explicitly subscribe later.
- Existing subscribers can unsubscribe from My Account.
- Changes synchronize the canonical `marketing_subscribers` record, Supabase Auth metadata and Brevo.
- Unsubscribing removes the contact from the Community list and blacklists marketing email in Brevo; re-subscribing explicitly restores eligibility.
- Language updates remain independent from consent.
- Stability fix in `brevo-subscribe.js`: marketing source normalization is evaluated before consent logic.

## No SQL required
This release reuses `marketing_subscribers` created by v23.3. No new Supabase migration is required.
