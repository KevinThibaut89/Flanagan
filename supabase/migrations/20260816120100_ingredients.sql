-- The canonical ingredient vocabulary. This table is the join between what a
-- recipe asks for and what sits on your shelf: a recipe calling for `gin`
-- matches a bottle of `london-dry-gin` because the latter's parent chain leads
-- back to the former.

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind public.ingredient_kind not null,
  parent_id uuid references public.ingredients(id) on delete set null,
  -- Alternate names the autocomplete and the barcode importer should match on
  -- ("whiskey" for "whisky", "simple syrup" for "sugar syrup").
  aliases text[] not null default '{}',
  -- Surfaced on the one-tap Staples screen.
  is_staple boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index ingredients_parent_id_idx on public.ingredients (parent_id);
create index ingredients_kind_idx on public.ingredients (kind);
create index ingredients_is_staple_idx on public.ingredients (is_staple) where is_staple;
create index ingredients_aliases_idx on public.ingredients using gin (aliases);

alter table public.ingredients enable row level security;

-- Shared reference data: everyone reads it, signed-in users may extend it.
-- Nobody edits or deletes rows through the API; corrections go through a
-- migration so the vocabulary stays stable for existing recipes.
create policy "ingredients are readable by everyone"
  on public.ingredients for select
  using (true);

create policy "signed-in users can add ingredients"
  on public.ingredients for insert
  to authenticated
  with check (true);
