begin;
select plan(6);

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

select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'row level security is enabled on orders');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is((select count(*)::int from public.orders where org_id = '10000000-0000-0000-0000-00000000000a'), 1, 'org A user sees the org A order');
select is((select count(*)::int from public.orders where org_id = '10000000-0000-0000-0000-00000000000b'), 0, 'org A user cannot see the org B order');
select throws_ok(
  $$insert into public.orders (org_id, user_id, total_cents) values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a1', 1)$$,
  '42501', null, 'org A user cannot create an order for org B');
select throws_ok(
  $$insert into public.orders (org_id, user_id, status, total_cents) values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'paid', 1)$$,
  '42501', null, 'a member cannot create an order that is already paid');

reset role;
set local role anon;
select throws_ok($$select * from public.orders$$, '42501', null, 'the anonymous role has no access to orders');

select * from finish();
rollback;
