-- F04: a replayed Stripe event fulfilled the order twice.
-- Recording the event id and fulfilling the order happen in one transaction, so a failure
-- rolls both back and Stripe can retry, while a replay is a no-op.
create table public.processed_events (
  event_id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
alter table public.processed_events enable row level security;
revoke all on public.processed_events from anon, authenticated;

create function public.fulfil_checkout(
  p_event_id text,
  p_order_id uuid,
  p_invoice_number text,
  p_invoice_body text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  insert into public.processed_events (event_id, type)
  values (p_event_id, 'checkout.session.completed')
  on conflict (event_id) do nothing;
  if not found then
    return false;
  end if;

  select org_id into v_org from public.orders where id = p_order_id;
  if v_org is null then
    raise exception 'unknown order %', p_order_id;
  end if;

  update public.orders set status = 'paid' where id = p_order_id;
  insert into public.shipments (order_id) values (p_order_id);
  insert into public.invoices (order_id, org_id, number, body)
  values (p_order_id, v_org, p_invoice_number, p_invoice_body);
  return true;
end;
$$;

revoke all on function public.fulfil_checkout(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.fulfil_checkout(text, uuid, text, text) to service_role;
