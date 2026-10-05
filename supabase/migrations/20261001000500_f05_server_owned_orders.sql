-- F05, database side. The checkout route no longer trusts the browser for prices, but the
-- database API still let a signed-in user insert their own orders and order lines directly,
-- with any unit price. Orders and their lines are now written only by the server.
drop policy if exists orders_insert on public.orders;
drop policy if exists order_items_insert on public.order_items;
revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;
