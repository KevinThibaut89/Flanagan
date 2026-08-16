-- The barcode catalogue, shared across users. Resolving a barcode once — from
-- Open Food Facts or by hand — means every later scan of that bottle is an
-- instant local hit.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique,
  name text not null,
  brand text,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  abv numeric(4, 1) check (abv >= 0 and abv <= 100),
  volume_ml integer check (volume_ml > 0),
  country text,
  image_url text,
  source public.product_source not null default 'user',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_ingredient_id_idx on public.products (ingredient_id);
create index products_name_idx on public.products (lower(name));

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

create policy "products are readable by everyone"
  on public.products for select
  using (true);

create policy "signed-in users can add products"
  on public.products for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

-- Only the person who first catalogued a barcode can correct it. Rows written
-- by the Open Food Facts importer have a null created_by and are edited
-- server-side by the edge function, not from the app.
create policy "contributors can correct their own products"
  on public.products for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
