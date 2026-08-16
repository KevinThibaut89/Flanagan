-- Your bar. Both real bottles and pantry staples live here — "can I make this
-- right now?" needs to know you have limes just as much as it needs to know you
-- have gin, and modelling them separately would mean two of every query.

create table public.bottles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Set when the bottle came from a barcode scan. Null for hand-entered items
  -- and for every staple.
  product_id uuid references public.products(id) on delete set null,
  -- What this counts as when matching recipes. Null means the item exists in
  -- the inventory but cannot satisfy a recipe requirement.
  ingredient_id uuid references public.ingredients(id) on delete set null,

  -- Denormalised from the product so renaming your bottle ("the good rum")
  -- never mutates the shared catalogue.
  name text not null,
  brand text,

  kind public.bottle_kind not null default 'bottle',
  abv numeric(4, 1) check (abv >= 0 and abv <= 100),
  volume_ml integer check (volume_ml > 0),
  fill_pct smallint not null default 100 check (fill_pct between 0 and 100),
  status public.bottle_status not null default 'in_stock',
  opened_at date,
  price numeric(10, 2),
  currency text,
  notes text,
  image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The hot path: "everything I currently have", filtered by status.
create index bottles_user_status_idx on public.bottles (user_id, status);
-- Backs the availability lookup used by can_make() and the AI prompt.
create index bottles_user_ingredient_idx on public.bottles (user_id, ingredient_id)
  where ingredient_id is not null;

create trigger bottles_touch_updated_at
  before update on public.bottles
  for each row execute function public.touch_updated_at();

alter table public.bottles enable row level security;

create policy "users read their own bottles"
  on public.bottles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users add their own bottles"
  on public.bottles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users update their own bottles"
  on public.bottles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users delete their own bottles"
  on public.bottles for delete
  to authenticated
  using ((select auth.uid()) = user_id);
