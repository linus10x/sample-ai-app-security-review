begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pg-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pg-b@example.com');
insert into public.orgs (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'pgTAP org A'),
  ('10000000-0000-0000-0000-00000000000b', 'pgTAP org B');
insert into public.profiles (user_id, org_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'member'),
  ('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'member');
insert into public.orders (id, org_id, user_id, total_cents) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 100),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 200);
insert into public.products (id, sku, name, price_cents, stripe_price_id) values
  ('30000000-0000-0000-0000-000000000001', 'PG-1', 'pgTAP item', 100, 'price_pg');
insert into public.order_items (id, order_id, product_id, quantity, unit_cents) values
  ('40000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 100);

select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'row level security is enabled on orders');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- Row level security: the select policy is what isolates the organisations.
select is((select count(*)::int from public.orders where org_id = '10000000-0000-0000-0000-00000000000a'), 1, 'org A user sees the org A order');
select is((select count(*)::int from public.orders where org_id = '10000000-0000-0000-0000-00000000000b'), 0, 'org A user cannot see the org B order');

-- Members have no write access at all: orders and lines are written by the server (F05).
select throws_ok(
  $$insert into public.orders (org_id, user_id, total_cents) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 1)$$,
  '42501', null, 'a member cannot insert an order, even for their own organisation');
select throws_ok(
  $$update public.orders set status = 'paid' where id = '20000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'a member cannot update their own order');
select throws_ok(
  $$delete from public.orders where id = '20000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'a member cannot delete their own order');
select throws_ok(
  $$update public.order_items set unit_cents = 1 where id = '40000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'a member cannot change the price on an order line');
select throws_ok(
  $$insert into public.order_items (order_id, product_id, quantity, unit_cents) values ('20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1, 1)$$,
  '42501', null, 'a member cannot add a line to an order');

reset role;
set local role anon;
select throws_ok($$select * from public.orders$$, '42501', null, 'the anonymous role has no access to orders');

select * from finish();
rollback;
