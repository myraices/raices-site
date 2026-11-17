begin;

alter table public.orders
  add column if not exists team_order_email_claimed_at timestamptz,
  add column if not exists team_order_email_sent_at timestamptz,
  add column if not exists review_email_language text,
  add column if not exists review_email_claimed_at timestamptz,
  add column if not exists review_email_sent_at timestamptz;

create or replace function public.claim_due_review_emails()
returns table(order_id uuid, customer_email text, email_language text, claimed_at timestamptz)
language sql
set search_path = public
as $$
  with candidates as (
    select o.id
    from public.orders o
    left join lateral (
      select max(d.delivered_at) as confirmed_at
      from public.deliveries d
      where d.order_id = o.id and d.status in ('delivered', 'completed')
    ) local_delivery on o.fulfillment_type = 'delivery'
    left join lateral (
      select case when s.shipment_status = 'delivered' then s.delivered_at end as confirmed_at
      from public.order_shipments s
      where s.order_id = o.id
      order by s.shipment_number desc
      limit 1
    ) shipping on o.fulfillment_type = 'shipping'
    where o.review_email_sent_at is null
      and o.review_email_language in ('es', 'en')
      and (o.review_email_claimed_at is null or o.review_email_claimed_at < now() - interval '15 minutes')
      and o.is_test is false and o.checkout_environment = 'production'
      and o.payment_status in ('paid', 'completed')
      and coalesce(o.refunded_amount, 0) = 0
      and o.status in ('delivered', 'completed')
      and coalesce(local_delivery.confirmed_at, shipping.confirmed_at) <= now() - interval '72 hours'
      and nullif(trim(o.customer_email), '') is not null
      and not exists (
        select 1 from public.marketing_subscribers m
        where lower(m.email) = lower(o.customer_email) and m.status = 'unsubscribed'
      )
    order by coalesce(local_delivery.confirmed_at, shipping.confirmed_at), o.id
    limit 10
    for update of o skip locked
  )
  update public.orders o
  set review_email_claimed_at = now()
  from candidates c
  where o.id = c.id
  returning o.id, o.customer_email::text, o.review_email_language, o.review_email_claimed_at;
$$;

revoke all on function public.claim_due_review_emails() from public, anon, authenticated;
grant execute on function public.claim_due_review_emails() to service_role;

commit;
