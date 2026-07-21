# Raíces v128.4 — Customer Nurture Foundation

## Purpose
Prepare registered users for a future Brevo nurture sequence without activating promotional emails yet.

## Registration behavior
- Marketing consent is optional and unchecked by default.
- Account creation works whether consent is accepted or not.
- Only users who opt in are synchronized to Brevo for marketing.
- Consent, language and account creation date are stored in Supabase Auth user metadata.
- On the first successful login after email confirmation, Brevo receives `EMAIL_VERIFIED = true`.

## Brevo contact attributes to create
Create these attributes in **Contacts > Settings > Contact attributes** before activating the automation:

| Attribute | Type |
|---|---|
| `ACCOUNT_CREATED_AT` | Date |
| `EMAIL_VERIFIED` | Boolean |
| `MARKETING_CONSENT` | Boolean |
| `MARKETING_CONSENT_AT` | Date |
| `FIRST_ORDER_COMPLETED` | Boolean |
| `FIRST_ORDER_DATE` | Date |
| `TOTAL_ORDERS` | Number |

Existing attributes reused: `FIRSTNAME`, `LOCALE`, `SOURCE`.

The server function includes a safe fallback: if these attributes have not yet been created in Brevo, account registration will continue and the existing contact fields will still sync.

## Recommended automation entry conditions
Activate later using all conditions:

- Contact belongs to the website community/registered-user list.
- `MARKETING_CONSENT = true`.
- `EMAIL_VERIFIED = true`.
- `TOTAL_ORDERS = 0`.
- `FIRST_ORDER_COMPLETED = false`.

Wait 3 days before Email 1.

## Exit conditions
Immediately remove the contact from the sequence when:

- `TOTAL_ORDERS > 0`, or
- `FIRST_ORDER_COMPLETED = true`, or
- contact unsubscribes.

## Preopening status
No automated promotional sequence is activated by this release. The website only captures and synchronizes the data required to configure it safely in Brevo.
