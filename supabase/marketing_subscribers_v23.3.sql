-- MyRaices / NURAI v23.3 · Email Marketing Foundation
-- Ejecutar una sola vez en Supabase SQL Editor antes de probar Marketing > Suscriptores.

create table if not exists public.marketing_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid null references auth.users(id) on delete set null,
  name text,
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed')),
  preferred_language text not null default 'es' check (preferred_language in ('es','en')),
  consent_source text not null default 'website',
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  last_synced_brevo_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_subscribers_status_idx on public.marketing_subscribers(status);
create index if not exists marketing_subscribers_user_idx on public.marketing_subscribers(user_id);

alter table public.marketing_subscribers enable row level security;

-- La web pública nunca escribe directamente en esta tabla: lo hacen funciones Netlify con service role.
-- NURAI tampoco necesita acceso directo; consulta mediante función administrativa protegida.
revoke all on table public.marketing_subscribers from anon, authenticated;

comment on table public.marketing_subscribers is
  'Registro canónico de consentimiento de email marketing. Un registro por email. Separado de Auth, admin_users, pedidos y waitlists.';
comment on column public.marketing_subscribers.consent_source is
  'Fuente original o última re-suscripción explícita: home, blog, signup, etc.';

-- Backfill conservador: solo fuentes que ya tenían consentimiento explícito.
insert into public.marketing_subscribers (email, user_id, name, status, preferred_language, consent_source, consent_at, created_at, updated_at)
select lower(btrim(ri.email)), ri.user_id, max(ri.name), 'subscribed',
       case when max(ri.language) ilike 'en%' then 'en' else 'es' end,
       'home', min(ri.created_at), min(ri.created_at), now()
from public.raices_interests ri
where ri.email is not null
  and ri.source in ('newsletter','newsletter_section')
  and coalesce((ri.payload->>'consent')::boolean, false) = true
group by lower(btrim(ri.email)), ri.user_id
on conflict (email) do nothing;

-- Cuentas MyRaices que marcaron explícitamente marketing al registrarse.
insert into public.marketing_subscribers (email, user_id, name, status, preferred_language, consent_source, consent_at, created_at, updated_at)
select lower(btrim(u.email)), u.id,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
       'subscribed',
       case when coalesce(u.raw_user_meta_data->>'preferred_language',u.raw_user_meta_data->>'language','es') ilike 'en%' then 'en' else 'es' end,
       'signup',
       coalesce(nullif(u.raw_user_meta_data->>'marketing_consent_at','')::timestamptz, u.created_at),
       u.created_at, now()
from auth.users u
where u.email is not null
  and coalesce((u.raw_user_meta_data->>'marketing_consent')::boolean, false) = true
  and coalesce(u.raw_user_meta_data->>'account_scope','') <> 'nurai'
on conflict (email) do update set
  user_id = coalesce(public.marketing_subscribers.user_id, excluded.user_id),
  name = coalesce(public.marketing_subscribers.name, excluded.name),
  updated_at = now();

-- Nota: legacy blog_newsletter NO se migra, porque antes de v23.3 el Blog asumía consent=true
-- sin checkbox explícito. Esos registros históricos permanecen en raices_interests, no en marketing_subscribers.
