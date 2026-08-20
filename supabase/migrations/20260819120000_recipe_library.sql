-- The house book: every recipe the Barkeep has ever produced, kept and made
-- searchable, so that the next person asking for "something bitter and
-- stirred" can be answered from it.
--
-- Until now an Ask was a one-off. The model invented (or remembered) two or
-- three drinks, the edge function checked them against the shelf, the person
-- saw them, and unless they tapped Save the recipes evaporated. The same
-- question an hour later cost the same tokens and the same ask of quota, and
-- every good recipe the model ever wrote for anyone else was lost to everyone
-- else. This migration keeps them, in three tables and with one embedding per
-- recipe, and is used three ways by the edge functions:
--
--   1. Answer first from the library. The Ask is embedded, the library is
--      searched for close recipes makeable with the caller's own bar, and if
--      enough good matches exist they are returned without calling the model
--      and without spending an ask. Free users get free answers; that is the
--      feature, not a leak.
--   2. Ground the model. When the model is called, the closest library recipes
--      are handed to it as reference material ({{LIBRARY}} in prompt v3), so it
--      reuses and varies proven drinks instead of inventing from nothing.
--   3. Discover. The app can browse and semantically search the library, filter
--      to "makeable now", and save a library recipe into a personal library.
--
-- Shared, anonymous. `library_recipes` and its lines are readable by every
-- signed-in user and carry nothing about who asked. What was asked, and by
-- whom, lives in `library_asks`, which has RLS enabled and no policies — the
-- same deny-all idiom as ai_prompts: only the service role, inside an edge
-- function, ever reads or writes it. Keeping the private half in its own table
-- (rather than column grants on the public one) is the stronger guarantee and
-- sidesteps PostgREST's `select=*` footgun with partially granted columns.
--
-- Only suggest-cocktails writes here. read-recipe transcribes someone's book
-- or menu, which is theirs to keep private; the Barkeep's own inventions are
-- the house's to share.
--
-- Makeability is answered the same way as everywhere else, through
-- available_ingredient_ids() (20260816120600_makeability.sql), against a
-- denormalised `required_ingredient_ids` array on the recipe: one `<@` per row,
-- GIN-indexed, rather than a join per line.
--
-- Embeddings are OpenAI text-embedding-3-small at its native 1536 dimensions.
-- The model name is recorded per row so a future switch is a visible backfill
-- rather than a guess. The column is nullable on purpose: a failed embedding
-- call must not lose the recipe.

create extension if not exists vector with schema extensions;

-- ── Price the embedder ─────────────────────────────────────────────────────
-- Every model call is written to ai_usage and priced from ai_models; this keeps
-- that invariant for embeddings. is_allowed = false: no ai_prompts row may ever
-- point at it — its use is fixed by the width of the vector column, i.e. by
-- code, not by configuration. max_output_ceiling is irrelevant but must be > 0.

insert into public.ai_models (model, input_usd_per_mtok, cached_input_usd_per_mtok, output_usd_per_mtok, max_output_ceiling, is_allowed, priced_at, notes) values
  ('text-embedding-3-small', 0.02, null, 0, 1, false, '2026-08-19',
   'Embeddings for the recipe library (library_recipes.embedding, 1536 dims). Input-priced only. Not a prompt model: used by code, never by an ai_prompts row.');

-- ── The library ────────────────────────────────────────────────────────────

create table public.library_recipes (
  id uuid primary key default gen_random_uuid(),

  -- Dedupe key: folded title + sorted required ingredient slugs. Amounts are
  -- deliberately not part of it; the model's 45 ml today is 50 ml tomorrow and
  -- that is the same drink. Two different specs with the same name differ by
  -- ingredients; two names for the same spec are two rows, and that is fine.
  fingerprint text not null unique,

  -- The recipe itself: the same shape as public.recipes, minus ownership.
  title text not null,
  -- The model's one-line justification for the original asker. Shown in the
  -- app as the Barkeep's note; it names bottles, never people.
  rationale text,
  glass text,
  method public.recipe_method,
  ice public.recipe_ice,
  garnish text,
  instructions text[] not null default '{}',
  flavor_tags text[] not null default '{}',
  base_ingredient_id uuid references public.ingredients(id) on delete set null,
  abv_estimate numeric(4, 1) check (abv_estimate >= 0 and abv_estimate <= 100),
  servings smallint not null default 1 check (servings > 0),

  -- Every required (non-optional, non-garnish) line's ingredient id, copied
  -- from the lines at insert so that "can I make it" is `<@ available`.
  required_ingredient_ids uuid[] not null default '{}',

  -- Provenance of the text, without the person.
  ai_model text not null,
  prompt_version integer,
  -- How often the model has produced this exact drink; bumped on conflict.
  -- Doubles as a popularity signal for browsing.
  times_suggested integer not null default 1 check (times_suggested > 0),
  last_suggested_at timestamptz not null default now(),

  -- Retrieval. embed_text is the exact document that was embedded, kept so the
  -- table can be re-embedded without reconstructing it.
  embed_text text not null,
  embed_model text,
  embedding extensions.vector(1536),
  embedded_at timestamptz,

  created_at timestamptz not null default now()
);

comment on table public.library_recipes is
  'Every recipe suggest-cocktails has produced, deduplicated by fingerprint and embedded for search. Shared and anonymous; who asked lives in library_asks.';

create index library_recipes_embedding_idx
  on public.library_recipes using hnsw (embedding extensions.vector_cosine_ops);
create index library_recipes_required_idx
  on public.library_recipes using gin (required_ingredient_ids);
create index library_recipes_flavor_tags_idx
  on public.library_recipes using gin (flavor_tags);
create index library_recipes_popular_idx
  on public.library_recipes (times_suggested desc, created_at desc);
create index library_recipes_newest_idx
  on public.library_recipes (created_at desc);
create index library_recipes_base_idx
  on public.library_recipes (base_ingredient_id);

-- Same columns as recipe_ingredients, so the app renders a library recipe with
-- the components it already has and saves one through the editor's own path.
create table public.library_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.library_recipes(id) on delete cascade,

  ingredient_id uuid references public.ingredients(id) on delete set null,
  free_text text,

  amount_ml numeric(8, 2) check (amount_ml >= 0),
  amount_display numeric(8, 2) check (amount_display >= 0),
  unit_display public.measure_unit,

  is_optional boolean not null default false,
  is_garnish boolean not null default false,
  position smallint not null default 0,
  note text,

  constraint library_recipe_ingredients_needs_a_name
    check (ingredient_id is not null or free_text is not null)
);

create index library_recipe_ingredients_recipe_idx
  on public.library_recipe_ingredients (recipe_id, position);
create index library_recipe_ingredients_ingredient_idx
  on public.library_recipe_ingredients (ingredient_id);

-- The private half: what was asked, by whom, and which recipe it produced.
-- One row per recipe per ask, so "how often" is a count and "what do people
-- ask that leads here" is a query — neither of which the public table answers.
create table public.library_asks (
  id bigint generated always as identity primary key,
  recipe_id uuid not null references public.library_recipes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  query text not null,
  created_at timestamptz not null default now()
);

comment on table public.library_asks is
  'Private provenance for library_recipes: the ask text and the asker. Service role only — RLS enabled, no policies.';

create index library_asks_recipe_idx on public.library_asks (recipe_id, created_at desc);
create index library_asks_user_idx on public.library_asks (user_id, created_at desc);

-- ── Who may see what ───────────────────────────────────────────────────────

alter table public.library_recipes enable row level security;
alter table public.library_recipe_ingredients enable row level security;
alter table public.library_asks enable row level security;

-- The library is shared: any signed-in person reads it. Nobody writes it
-- through the API — only library_upsert below, called by the service role.
create policy "signed-in users read the library"
  on public.library_recipes for select
  to authenticated
  using (true);

create policy "signed-in users read library lines"
  on public.library_recipe_ingredients for select
  to authenticated
  using (true);

-- library_asks: no policies. Deny-all for anon and authenticated, like ai_prompts.

-- ── Writing: one call per Ask ──────────────────────────────────────────────
--
-- Takes the whole batch the model produced as jsonb, upserts each recipe by
-- fingerprint (a repeat bumps times_suggested; a new one gets its lines and its
-- required-ingredient array), records the ask against every recipe, and says
-- which rows were new. One transaction, so a half-written recipe cannot exist.
--
-- Each element of p_recipes:
--   { fingerprint, title, rationale, glass, method, ice, garnish,
--     instructions: text[], flavor_tags: text[], base_ingredient_id, abv_estimate,
--     servings, embed_text, embed_model, embedding: number[] | null,
--     ingredients: [{ ingredient_id, free_text, amount_ml, amount_display,
--                     unit_display, is_optional, is_garnish, note }] }
--
-- An embedding that arrives for a row whose earlier embed failed is kept; an
-- existing embedding is never overwritten by a repeat (same text, same vector).

create or replace function public.library_upsert(
  p_user_id uuid,
  p_query text,
  p_model text,
  p_prompt_version integer,
  p_recipes jsonb
)
returns table (id uuid, inserted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_id uuid;
  v_inserted boolean;
  v_embedding extensions.vector(1536);
begin
  if p_recipes is null or jsonb_typeof(p_recipes) <> 'array' then
    return;
  end if;

  for r in select value from jsonb_array_elements(p_recipes) loop
    v_embedding := case
      when jsonb_typeof(r->'embedding') = 'array' then (r->>'embedding')::extensions.vector(1536)
      else null
    end;

    insert into public.library_recipes as lr (
      fingerprint, title, rationale, glass, method, ice, garnish,
      instructions, flavor_tags, base_ingredient_id, abv_estimate, servings,
      ai_model, prompt_version,
      embed_text, embed_model, embedding, embedded_at
    ) values (
      r->>'fingerprint',
      r->>'title',
      nullif(r->>'rationale', ''),
      nullif(r->>'glass', ''),
      (r->>'method')::public.recipe_method,
      (r->>'ice')::public.recipe_ice,
      nullif(r->>'garnish', ''),
      case when jsonb_typeof(r->'instructions') = 'array'
           then array(select jsonb_array_elements_text(r->'instructions')) else '{}' end,
      case when jsonb_typeof(r->'flavor_tags') = 'array'
           then array(select jsonb_array_elements_text(r->'flavor_tags')) else '{}' end,
      (r->>'base_ingredient_id')::uuid,
      (r->>'abv_estimate')::numeric,
      coalesce((r->>'servings')::smallint, 1),
      p_model,
      p_prompt_version,
      coalesce(r->>'embed_text', r->>'title'),
      case when v_embedding is null then null else r->>'embed_model' end,
      v_embedding,
      case when v_embedding is null then null else now() end
    )
    on conflict (fingerprint) do update set
      times_suggested   = lr.times_suggested + 1,
      last_suggested_at = now(),
      embedding         = coalesce(lr.embedding, excluded.embedding),
      embed_model       = coalesce(lr.embed_model, excluded.embed_model),
      embedded_at       = coalesce(lr.embedded_at, excluded.embedded_at)
    -- xmax = 0 on a freshly inserted row; non-zero when the conflict branch ran.
    returning lr.id, (lr.xmax = 0)
    into v_id, v_inserted;

    if v_inserted then
      insert into public.library_recipe_ingredients (
        recipe_id, ingredient_id, free_text, amount_ml, amount_display, unit_display,
        is_optional, is_garnish, position, note
      )
      select
        v_id,
        (line->>'ingredient_id')::uuid,
        nullif(line->>'free_text', ''),
        (line->>'amount_ml')::numeric,
        (line->>'amount_display')::numeric,
        (line->>'unit_display')::public.measure_unit,
        coalesce((line->>'is_optional')::boolean, false),
        coalesce((line->>'is_garnish')::boolean, false),
        (ord - 1)::smallint,
        nullif(line->>'note', '')
      from jsonb_array_elements(
        case when jsonb_typeof(r->'ingredients') = 'array' then r->'ingredients' else '[]'::jsonb end
      ) with ordinality as t(line, ord)
      where (line->>'ingredient_id') is not null or nullif(line->>'free_text', '') is not null;

      update public.library_recipes lr
      set required_ingredient_ids = coalesce((
        select array_agg(distinct li.ingredient_id)
        from public.library_recipe_ingredients li
        where li.recipe_id = v_id
          and not li.is_optional
          and not li.is_garnish
          and li.ingredient_id is not null
      ), '{}')
      where lr.id = v_id;
    end if;

    insert into public.library_asks (recipe_id, user_id, query)
    values (v_id, p_user_id, p_query);

    id := v_id;
    inserted := v_inserted;
    return next;
  end loop;
end;
$$;

revoke execute on function public.library_upsert(uuid, text, text, integer, jsonb)
  from public, anon, authenticated;

-- ── Searching: nearest recipes, with makeability for a given person ────────
--
-- Service role only, like check_ai_quota: it takes an explicit user id, so it
-- must never be reachable with a spoofable one. The edge functions embed the
-- query (the OpenAI key lives there) and call this.
--
-- With search_path = '' the pgvector operator must be spelled
-- operator(extensions.<=>) and the type extensions.vector — a bare <=> does
-- not resolve inside the function body.
--
-- Note for later: if the table grows large and p_only_makeable starts
-- under-returning (HNSW finds k neighbours, then the filter drops most), set
-- hnsw.iterative_scan = relaxed_order inside this function (pgvector ≥ 0.8).

create or replace function public.library_search(
  p_user_id uuid,
  p_embedding extensions.vector(1536),
  p_count integer default 10,
  p_min_similarity real default 0,
  p_only_makeable boolean default false
)
returns table (
  id uuid,
  title text,
  rationale text,
  glass text,
  method public.recipe_method,
  ice public.recipe_ice,
  garnish text,
  instructions text[],
  flavor_tags text[],
  base_ingredient_id uuid,
  abv_estimate numeric,
  servings smallint,
  required_ingredient_ids uuid[],
  ai_model text,
  times_suggested integer,
  created_at timestamptz,
  ingredients jsonb,
  similarity real,
  makeable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with avail as (
    select coalesce(array_agg(a.ingredient_id), '{}'::uuid[]) as ids
    from public.available_ingredient_ids(p_user_id) a
  )
  select
    r.id, r.title, r.rationale, r.glass, r.method, r.ice, r.garnish,
    r.instructions, r.flavor_tags, r.base_ingredient_id, r.abv_estimate, r.servings,
    r.required_ingredient_ids, r.ai_model, r.times_suggested, r.created_at,
    (
      select coalesce(jsonb_agg(to_jsonb(l) order by l.position), '[]'::jsonb)
      from public.library_recipe_ingredients l
      where l.recipe_id = r.id
    ) as ingredients,
    (1 - (r.embedding operator(extensions.<=>) p_embedding))::real as similarity,
    (r.required_ingredient_ids <@ avail.ids) as makeable
  from public.library_recipes r, avail
  where r.embedding is not null
    and (not p_only_makeable or r.required_ingredient_ids <@ avail.ids)
    and (1 - (r.embedding operator(extensions.<=>) p_embedding)) >= p_min_similarity
  order by r.embedding operator(extensions.<=>) p_embedding
  limit greatest(1, least(coalesce(p_count, 10), 50));
$$;

revoke execute on function public.library_search(uuid, extensions.vector, integer, real, boolean)
  from public, anon, authenticated;

-- ── Browsing: no vector, the caller's own bar ──────────────────────────────
--
-- Security invoker, like my_makeable_recipe_ids(): the library is readable by
-- anyone signed in, and available_ingredient_ids() reads the caller's own
-- bottles under their RLS. Sorted newest or most-suggested.

create or replace function public.library_browse(
  p_only_makeable boolean default false,
  p_sort text default 'newest',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  rationale text,
  glass text,
  method public.recipe_method,
  ice public.recipe_ice,
  garnish text,
  instructions text[],
  flavor_tags text[],
  base_ingredient_id uuid,
  abv_estimate numeric,
  servings smallint,
  required_ingredient_ids uuid[],
  ai_model text,
  times_suggested integer,
  created_at timestamptz,
  ingredients jsonb,
  makeable boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with avail as (
    select coalesce(array_agg(a.ingredient_id), '{}'::uuid[]) as ids
    from public.available_ingredient_ids((select auth.uid())) a
  )
  select
    r.id, r.title, r.rationale, r.glass, r.method, r.ice, r.garnish,
    r.instructions, r.flavor_tags, r.base_ingredient_id, r.abv_estimate, r.servings,
    r.required_ingredient_ids, r.ai_model, r.times_suggested, r.created_at,
    (
      select coalesce(jsonb_agg(to_jsonb(l) order by l.position), '[]'::jsonb)
      from public.library_recipe_ingredients l
      where l.recipe_id = r.id
    ) as ingredients,
    (r.required_ingredient_ids <@ avail.ids) as makeable
  from public.library_recipes r, avail
  where (not p_only_makeable or r.required_ingredient_ids <@ avail.ids)
  order by
    case when p_sort = 'popular' then r.times_suggested end desc nulls last,
    r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function public.library_browse(boolean, text, integer, integer) from public, anon;
grant execute on function public.library_browse(boolean, text, integer, integer) to authenticated;
