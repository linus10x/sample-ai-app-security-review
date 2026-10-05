-- F04 follow-up. The event id stops a replay of the same event. This stops a second,
-- different event for an order that is already paid from fulfilling it again.
create or replace function public.fulfil_checkout(
  p_event_id text,
  p_order_id uuid,
  p_invoice_number text,
  p_invoice_body text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_status text;
begin
  insert into public.processed_events (event_id, type)
  values (p_event_id, 'checkout.session.completed')
  on conflict (event_id) do nothing;
  if not found then
    return false;
  end if;

  select org_id, status into v_org, v_status from public.orders where id = p_order_id;
  if v_org is null then
    raise exception 'unknown order %', p_order_id;
  end if;
  if v_status <> 'pending' then
    return false;
  end if;

  update public.orders set status = 'paid' where id = p_order_id;
  insert into public.shipments (order_id) values (p_order_id);
  insert into public.invoices (order_id, org_id, number, body)
  values (p_order_id, v_org, p_invoice_number, p_invoice_body);
  return true;
end;
$$;
