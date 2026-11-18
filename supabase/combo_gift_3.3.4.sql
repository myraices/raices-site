create table if not exists public.combo_gift_campaign (
  id integer primary key check (id = 1),
  active boolean not null default false,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  first_skus text[] not null,
  second_skus text[] not null,
  gift_skus text[] not null,
  first_qty integer not null default 1 check (first_qty between 1 and 20),
  second_qty integer not null default 1 check (second_qty between 1 and 20),
  check (cardinality(first_skus) > 0 and cardinality(second_skus) > 0 and cardinality(gift_skus) > 0),
  check (not (first_skus && second_skus or first_skus && gift_skus or second_skus && gift_skus))
);
alter table public.combo_gift_campaign enable row level security;
revoke all on public.combo_gift_campaign from anon, authenticated;
grant select, update on public.combo_gift_campaign to service_role;

insert into public.combo_gift_campaign (id, starts_on, ends_on, first_skus, second_skus, gift_skus)
values (
  1, '2026-11-17', '2026-11-23',
  array['RA-AR-001','RA-AR-002','RA-AR-003','RA-AR-004','RA-AR-005','RA-AR-006','RA-AR-007','RA-AR-008'],
  array['RA-PC-001','RA-PC-002','RA-PC-003','RA-PC-004','RA-PC-005'],
  array['RA-DE-001','RA-DE-002','RA-DE-003']
)
on conflict (id) do nothing;
