begin;
create table if not exists public.promotion_codes (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9_-]{3,40}$'),
 discount_type text not null check (discount_type in ('percentage','fixed')),
 value numeric(12,2) not null check (value>0 and (discount_type<>'percentage' or value<=100)),
 minimum_cents bigint not null default 0 check (minimum_cents>=0),
 starts_on date, ends_on date,
 max_uses integer check (max_uses>0),
 active boolean not null default true,
 first_purchase_only boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (starts_on is null or ends_on is null or starts_on<=ends_on)
);
create table if not exists public.promotion_redemptions (
 session_id uuid primary key references public.checkout_sessions(id),
 promotion_id uuid not null references public.promotion_codes(id),
 code text not null,
 discount_cents bigint not null check (discount_cents>=0),
 state text not null default 'reserved' check(state in ('reserved','paid','released')),
 user_id uuid, customer_email text, environment text not null default 'sandbox' check(environment in ('sandbox','production')),
 first_only boolean not null default false,
 order_id uuid references public.orders(id) on delete set null,
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index if not exists promotion_redemptions_promotion on public.promotion_redemptions(promotion_id,state);
alter table public.orders add column if not exists promotion_user_id uuid;
create unique index if not exists promotion_first_customer_pending on public.promotion_redemptions(user_id,environment) where first_only and state='reserved';
alter table public.orders add column if not exists promotion_code text;
alter table public.orders add column if not exists promotion_checkout_id uuid references public.promotion_redemptions(session_id);
-- No browser role may enumerate codes, set prices, reserve uses, or change counters.
alter table public.promotion_codes enable row level security;
alter table public.promotion_redemptions enable row level security;
revoke all on public.promotion_codes,public.promotion_redemptions from public,anon,authenticated;
grant all on public.promotion_codes,public.promotion_redemptions to service_role;
create or replace function public.promotion_usage_count(p_promotion_id uuid,p_environment text)
returns bigint language sql security definer set search_path=public as $$
 select count(*) from public.promotion_redemptions where promotion_id=p_promotion_id and environment=p_environment and state<>'released';
$$;
create or replace function public.promotion_customer_state(p_user_id uuid,p_email text,p_environment text)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
 'eligible',not exists(select 1 from public.orders o
  where (lower(btrim(o.customer_email))=lower(btrim(p_email)) or o.promotion_user_id=p_user_id)
   and (o.payment_status in ('completed','partially_refunded','refunded') or o.paid_at is not null)
   and coalesce(o.is_test,false)=(p_environment='sandbox'))
  and not exists(select 1 from public.promotion_redemptions r where r.user_id=p_user_id and r.environment=p_environment and r.first_only and r.state='paid'),
 'pending',exists(select 1 from public.promotion_redemptions r where r.user_id=p_user_id and r.environment=p_environment and r.first_only and r.state='reserved'));
$$;
create or replace function public.reserve_promotion(p_code text,p_session_id uuid,p_subtotal_cents bigint,p_discount_cents bigint,p_updated_at timestamptz,p_user_id uuid,p_email text,p_environment text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.promotion_codes%rowtype; r public.promotion_redemptions%rowtype;
 used bigint; expected bigint; customer_state jsonb; today date := (now() at time zone 'America/Chicago')::date;
begin
 select * into p from public.promotion_codes where code=p_code for update;
 if not found or not p.active then raise exception 'PROMO_INVALID'; end if;
 if p_environment not in ('sandbox','production') then raise exception 'PROMO_INVALID'; end if;
 if p.first_purchase_only then
   if p_user_id is null or coalesce(p_email,'')='' then raise exception 'PROMO_LOGIN_REQUIRED'; end if;
   -- Serializes a customer's first-purchase reservations even across different codes.
   perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_environment,0));
 end if;
 select * into r from public.promotion_redemptions where session_id=p_session_id;
 if found then
   if r.promotion_id<>p.id or r.discount_cents<>p_discount_cents or r.state='released' then raise exception 'PROMO_CHANGED'; end if;
   return to_jsonb(r);
 end if;
 if p.first_purchase_only then
  customer_state:=public.promotion_customer_state(p_user_id,p_email,p_environment);
  if not (customer_state->>'eligible')::boolean then raise exception 'PROMO_NOT_FIRST_PURCHASE'; end if;
  if (customer_state->>'pending')::boolean then raise exception 'PROMO_PENDING_CHECKOUT'; end if;
 end if;
 if p_updated_at is distinct from p.updated_at then raise exception 'PROMO_CHANGED'; end if;
 if (p.starts_on is not null and today<p.starts_on) or (p.ends_on is not null and today>p.ends_on) then raise exception 'PROMO_EXPIRED'; end if;
 if p_subtotal_cents is null or p_subtotal_cents<=0 or p_subtotal_cents<p.minimum_cents then raise exception 'PROMO_MINIMUM'; end if;
 expected := least(p_subtotal_cents,case when p.discount_type='percentage' then round(p_subtotal_cents*p.value/100)::bigint else round(p.value*100)::bigint end);
 if p_discount_cents is distinct from expected then raise exception 'PROMO_CHANGED'; end if;
 select count(*) into used from public.promotion_redemptions where promotion_id=p.id and environment=p_environment and state<>'released';
 if p.max_uses is not null and used>=p.max_uses then raise exception 'PROMO_LIMIT_REACHED'; end if;
 insert into public.promotion_redemptions(session_id,promotion_id,code,discount_cents,user_id,customer_email,environment,first_only)
 values(p_session_id,p.id,p.code,expected,p_user_id,lower(btrim(p_email)),p_environment,p.first_purchase_only) returning * into r;
 return to_jsonb(r);
end;
$$;
create or replace function public.promotion_order_paid()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.promotion_checkout_id is not null and new.payment_status in ('completed','partially_refunded','refunded') then
  update public.promotion_redemptions set state='paid',order_id=new.id,paid_at=coalesce(paid_at,now()) where session_id=new.promotion_checkout_id;
 end if;
 return new;
end;
$$;
drop trigger if exists promotion_order_paid_trigger on public.orders;
create trigger promotion_order_paid_trigger after insert or update of payment_status on public.orders for each row execute function public.promotion_order_paid();
revoke all on function public.promotion_usage_count(uuid,text) from public,anon,authenticated;
revoke all on function public.reserve_promotion(text,uuid,bigint,bigint,timestamptz,uuid,text,text) from public,anon,authenticated;
revoke all on function public.promotion_order_paid() from public,anon,authenticated;
revoke all on function public.promotion_customer_state(uuid,text,text) from public,anon,authenticated;
grant execute on function public.promotion_customer_state(uuid,text,text) to service_role;
grant execute on function public.promotion_usage_count(uuid,text),public.reserve_promotion(text,uuid,bigint,bigint,timestamptz,uuid,text,text) to service_role;
create or replace function public.promotion_admin_usage()
returns table(promotion_id uuid,paid_uses bigint,reserved_uses bigint)
language sql security definer set search_path=public as $$
 select promotion_id,count(*) filter(where state='paid'),count(*) filter(where state='reserved') from public.promotion_redemptions where environment='production' group by promotion_id;
$$;
revoke all on function public.promotion_admin_usage() from public,anon,authenticated;
grant execute on function public.promotion_admin_usage() to service_role;
insert into public.promotion_codes(code,discount_type,value,first_purchase_only) values('BIENVENIDO10','percentage',10,true) on conflict(code) do nothing;
notify pgrst,'reload schema';
commit;
