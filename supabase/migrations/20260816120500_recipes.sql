-- The standardised recipe format. There is exactly one of these: an AI
-- suggestion you save and a recipe you type by hand produce identical rows,
-- differing only in `source`.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  source public.recipe_source not null default 'user',

  glass text,
  method public.recipe_method,
  ice public.recipe_ice,
  garnish text,
  -- Ordered steps. An array rather than prose so the detail screen can number
  -- them and a future timer feature can walk them.
  instructions text[] not null default '{}',
  notes text,

  -- Free-form descriptors: 'floral', 'dry', 'spirit-forward', 'refreshing'.
  -- These are what a natural-language request gets matched against.
  flavor_tags text[] not null default '{}',
  base_ingredient_id uuid references public.ingredients(id) on delete set null,

  abv_estimate numeric(4, 1) check (abv_estimate >= 0 and abv_estimate <= 100),
  servings smallint not null default 1 check (servings > 0),
  is_favorite boolean not null default false,

  -- Provenance for source = 'ai', so you can see what you actually asked for
  -- six months later.
  ai_prompt text,
  ai_model text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_user_idx on public.recipes (user_id, created_at desc);
create index recipes_user_favorite_idx on public.recipes (user_id) where is_favorite;
create index recipes_base_ingredient_idx on public.recipes (base_ingredient_id);
create index recipes_flavor_tags_idx on public.recipes using gin (flavor_tags);

create trigger recipes_touch_updated_at
  before update on public.recipes
  for each row execute function public.touch_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,

  -- Set when the line resolves to the canonical vocabulary, which is what makes
  -- it matchable against your bar. Free text alone is allowed as an escape
  -- hatch, but such a line can never be verified as available.
  ingredient_id uuid references public.ingredients(id) on delete set null,
  free_text text,

  -- Normalised amount, always millilitres. Null for countable or
  -- to-taste items ("1 egg white", "top with soda").
  amount_ml numeric(8, 2) check (amount_ml >= 0),
  -- How the amount was authored, preserved verbatim: a dash stays a dash even
  -- though it is ~0.9 ml. The UI renders these unless the unit is ml/cl/oz, in
  -- which case it converts from amount_ml per your preference.
  amount_display numeric(8, 2) check (amount_display >= 0),
  unit_display public.measure_unit,

  is_optional boolean not null default false,
  is_garnish boolean not null default false,
  position smallint not null default 0,
  note text,

  constraint recipe_ingredients_needs_a_name
    check (ingredient_id is not null or free_text is not null)
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "users read their own recipes"
  on public.recipes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users add their own recipes"
  on public.recipes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users update their own recipes"
  on public.recipes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users delete their own recipes"
  on public.recipes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Ingredient lines inherit their owner from the parent recipe.
create policy "users read ingredients of their own recipes"
  on public.recipe_ingredients for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  );

create policy "users add ingredients to their own recipes"
  on public.recipe_ingredients for insert
  to authenticated
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  );

create policy "users update ingredients of their own recipes"
  on public.recipe_ingredients for update
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  );

create policy "users delete ingredients of their own recipes"
  on public.recipe_ingredients for delete
  to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.user_id = (select auth.uid())
    )
  );
