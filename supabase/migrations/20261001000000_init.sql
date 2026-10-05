-- Cedar Supply Portal: initial schema (v0, as first shipped)

create extension if not exists pgcrypto;

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.orgs (id),
  role text not null default 'member' check (role in ('member', 'admin')),
  full_name text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  stripe_price_id text not null,
  created_at timestamptz not null default now()
);

create table public.product_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id),
  product_id uuid not null references public.products (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id),
  user_id uuid not null references auth.users (id),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  total_cents integer not null check (total_cents >= 0),
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_cents integer not null check (unit_cents >= 0)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  org_id uuid not null references public.orgs (id),
  number text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where user_id = auth.uid()
$$;

alter table public.orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_notes enable row level security;
alter table public.order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.shipments enable row level security;
-- orders: row level security left off while building the checkout flow.
alter table public.orders disable row level security;

create policy orgs_select on public.orgs for select to authenticated
  using (id = public.current_org_id());
create policy profiles_select on public.profiles for select to authenticated
  using (org_id = public.current_org_id());
create policy products_select on public.products for select to authenticated using (true);
create policy notes_select on public.product_notes for select to authenticated
  using (org_id = public.current_org_id());
create policy notes_insert on public.product_notes for insert to authenticated
  with check (org_id = public.current_org_id() and author_id = auth.uid());
create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.org_id = public.current_org_id()));
create policy order_items_insert on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.org_id = public.current_org_id()));
create policy invoices_select on public.invoices for select to authenticated
  using (org_id = public.current_org_id());
