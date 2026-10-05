-- F01: orders was readable and writable across organisations.
alter table public.orders enable row level security;

create policy orders_select on public.orders for select to authenticated
  using (org_id = public.current_org_id());

-- Members may only create pending orders for their own organisation and themselves.
-- Status changes after that happen on the server with the service role.
create policy orders_insert on public.orders for insert to authenticated
  with check (org_id = public.current_org_id() and user_id = auth.uid() and status = 'pending');

-- Nothing in the app reads these tables as the anonymous role.
revoke all on all tables in schema public from anon;
