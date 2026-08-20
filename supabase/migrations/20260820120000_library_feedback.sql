-- Taste: thumbs up and down on the Barkeep's suggestions, and what they change.
--
-- Until now the house book knew what it had served but not whether anyone
-- enjoyed it. This migration adds the one explicit signal — a vote per person
-- per library recipe — and threads it, together with two implicit signals the
-- app already produces (saving a suggestion, favouriting a saved recipe), into
-- every place a suggestion is chosen:
--
--   1. `library_answer` (the answer-first shortcut) and `library_search` (the
--      model's grounding list and Discover) hard-exclude anything this person
--      voted down, and nudge the ordering by their likes and by flavour-tag
--      affinity. The nudge is clamped: taste reorders near-ties, it never
--      fakes a match — thresholds still run on raw similarity.
--   2. `library_taste_profile` aggregates the same signals into a small jsonb
--      profile the edge function renders into the prompt's {{TASTE}} block
--      (prompt v4, 20260820120100).
--
-- Votes are user-owned rows written directly by the app under RLS, like
-- bottles and recipes; tapping the active thumb again deletes the row. The
-- implicit signals are NOT copied anywhere — they are derived at query time
-- from `recipes` via a new nullable `recipes.library_recipe_id`, so unsaving
-- or unfavouriting self-corrects. Weights: explicit vote ±2, save +1,
-- favourite a further +1.
--
-- The ranking RPCs are service-role only and take an explicit p_user_id
-- (unchanged), so they may join `recipes` and `library_feedback` freely.
-- Rollback kit: supabase/backups/20260820-pre-feedback/.

-- ── Votes ────────────────────────────────────────────────────────────────────

create table public.library_feedback (
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  uuid not null references public.library_recipes(id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

comment on table public.library_feedback is
  'Thumbs up (+1) / down (-1) per person per library recipe. A -1 hard-excludes the recipe from that person''s suggestions; both feed the taste profile.';

create index library_feedback_recipe_idx on public.library_feedback (recipe_id);

alter table public.library_feedback enable row level security;

create policy "users read their own votes"
  on public.library_feedback for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users cast their own votes"
  on public.library_feedback for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users change their own votes"
  on public.library_feedback for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users withdraw their own votes"
  on public.library_feedback for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ── Saved recipes remember their library page ────────────────────────────────
-- Saving a suggestion (or a Discover recipe) is a quiet "I want this"; the
-- link is what lets the taste profile count it. Nullable: hand-written and
-- pre-migration recipes simply carry no signal.

alter table public.recipes
  add column library_recipe_id uuid references public.library_recipes(id) on delete set null;

create index recipes_library_recipe_idx
  on public.recipes (library_recipe_id)
  where library_recipe_id is not null;

-- ── The taste profile, for the prompt ────────────────────────────────────────
-- Service role only, like library_answer: explicit user id, must never be
-- reachable with a spoofable one. Small on purpose — a handful of tags either
-- way and the last few "never again" titles; the prompt block stays cheap.

create or replace function public.library_taste_profile(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with signals as (
    select r.flavor_tags, (f.vote * 2)::real as w
    from public.library_feedback f
    join public.library_recipes r on r.id = f.recipe_id
    where f.user_id = p_user_id
    union all
    select r.flavor_tags, (1 + (rec.is_favorite)::int)::real
    from public.recipes rec
    join public.library_recipes r on r.id = rec.library_recipe_id
    where rec.user_id = p_user_id
  ),
  tags as (
    select tag, sum(w)::real as weight
    from signals, unnest(flavor_tags) as tag
    group by tag
  )
  select jsonb_build_object(
    'liked_tags',
    (select coalesce(jsonb_agg(t.tag order by t.weight desc), '[]'::jsonb)
     from (select tag, weight from tags where weight > 0 order by weight desc limit 6) t),
    'disliked_tags',
    (select coalesce(jsonb_agg(t.tag order by t.weight), '[]'::jsonb)
     from (select tag, weight from tags where weight < 0 order by weight asc limit 6) t),
    'avoid_titles',
    (select coalesce(jsonb_agg(r.title order by f.updated_at desc), '[]'::jsonb)
     from (select recipe_id, updated_at
           from public.library_feedback
           where user_id = p_user_id and vote = -1
           order by updated_at desc limit 10) f
     join public.library_recipes r on r.id = f.recipe_id)
  );
$$;

revoke execute on function public.library_taste_profile(uuid)
  from public, anon, authenticated;

-- ── library_answer: never a downvoted drink, likes and affinity break ties ──
-- Same signature and shape as 20260819130000; the additions are the `taste`
-- CTE, the left join on the caller's votes, the hard exclusion, and the
-- nudged ordering. Nudge magnitudes against the ask-similarity scale (0.72
-- threshold, 0.8 "same wish" — see _shared/library.ts): +0.04 for an explicit
-- like, ±0.05 at most from tag affinity — enough to reorder neighbours, never
-- enough to clear a threshold the raw similarity did not.

create or replace function public.library_answer(
  p_user_id uuid,
  p_embedding extensions.vector(1536),
  p_count integer default 3,
  p_min_similarity real default 0.8
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
  ),
  taste as (
    select tag, sum(w)::real as weight
    from (
      select unnest(r2.flavor_tags) as tag, (f2.vote * 2)::real as w
      from public.library_feedback f2
      join public.library_recipes r2 on r2.id = f2.recipe_id
      where f2.user_id = p_user_id
      union all
      select unnest(r2.flavor_tags), (1 + (rec.is_favorite)::int)::real
      from public.recipes rec
      join public.library_recipes r2 on r2.id = rec.library_recipe_id
      where rec.user_id = p_user_id
    ) s
    group by tag
  ),
  near_asks as (
    select a.recipe_id,
           max(1 - (a.embedding operator(extensions.<=>) p_embedding))::real as similarity
    from public.library_asks a
    where a.embedding is not null
      and (1 - (a.embedding operator(extensions.<=>) p_embedding)) >= p_min_similarity
    group by a.recipe_id
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
    n.similarity,
    true as makeable
  from near_asks n
  join public.library_recipes r on r.id = n.recipe_id
  cross join avail
  left join public.library_feedback f
    on f.user_id = p_user_id and f.recipe_id = r.id
  where r.required_ingredient_ids <@ avail.ids
    and coalesce(f.vote, 0) <> -1
  order by
    ( n.similarity
      + case when f.vote = 1 then 0.04 else 0 end
      + greatest(-0.05, least(0.05, 0.01 * coalesce(
          (select sum(t.weight) from taste t where t.tag = any(r.flavor_tags)), 0)))
    ) desc,
    r.times_suggested desc, r.created_at desc
  limit greatest(1, least(coalesce(p_count, 3), 10));
$$;

revoke execute on function public.library_answer(uuid, extensions.vector, integer, real)
  from public, anon, authenticated;

-- ── library_search: same exclusion and nudge, HNSW kept honest ──────────────
-- The KNN stays an inner query ordered by the raw distance operator with an
-- over-fetched limit (3×), so the HNSW index keeps doing the work; the outer
-- select re-ranks those candidates by taste. `similarity` returned is still
-- the raw value — the edge functions log and threshold on it. Signature
-- unchanged, so search-library needs no redeploy for correctness (it gets one
-- anyway, for the shared-module bump).

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
  ),
  taste as (
    select tag, sum(w)::real as weight
    from (
      select unnest(r2.flavor_tags) as tag, (f2.vote * 2)::real as w
      from public.library_feedback f2
      join public.library_recipes r2 on r2.id = f2.recipe_id
      where f2.user_id = p_user_id
      union all
      select unnest(r2.flavor_tags), (1 + (rec.is_favorite)::int)::real
      from public.recipes rec
      join public.library_recipes r2 on r2.id = rec.library_recipe_id
      where rec.user_id = p_user_id
    ) s
    group by tag
  ),
  knn as (
    select
      r.id, r.title, r.rationale, r.glass, r.method, r.ice, r.garnish,
      r.instructions, r.flavor_tags, r.base_ingredient_id, r.abv_estimate, r.servings,
      r.required_ingredient_ids, r.ai_model, r.times_suggested, r.created_at,
      (1 - (r.embedding operator(extensions.<=>) p_embedding))::real as similarity,
      (r.required_ingredient_ids <@ avail.ids) as makeable
    from public.library_recipes r, avail
    where r.embedding is not null
      and (not p_only_makeable or r.required_ingredient_ids <@ avail.ids)
      and (1 - (r.embedding operator(extensions.<=>) p_embedding)) >= p_min_similarity
      and not exists (
        select 1 from public.library_feedback fx
        where fx.user_id = p_user_id and fx.recipe_id = r.id and fx.vote = -1
      )
    order by r.embedding operator(extensions.<=>) p_embedding
    limit greatest(1, least(coalesce(p_count, 10), 50)) * 3
  )
  select
    k.id, k.title, k.rationale, k.glass, k.method, k.ice, k.garnish,
    k.instructions, k.flavor_tags, k.base_ingredient_id, k.abv_estimate, k.servings,
    k.required_ingredient_ids, k.ai_model, k.times_suggested, k.created_at,
    (
      select coalesce(jsonb_agg(to_jsonb(l) order by l.position), '[]'::jsonb)
      from public.library_recipe_ingredients l
      where l.recipe_id = k.id
    ) as ingredients,
    k.similarity,
    k.makeable
  from knn k
  left join public.library_feedback f
    on f.user_id = p_user_id and f.recipe_id = k.id
  order by
    ( k.similarity
      + case when f.vote = 1 then 0.04 else 0 end
      + greatest(-0.05, least(0.05, 0.01 * coalesce(
          (select sum(t.weight) from taste t where t.tag = any(k.flavor_tags)), 0)))
    ) desc
  limit greatest(1, least(coalesce(p_count, 10), 50));
$$;

revoke execute on function public.library_search(uuid, extensions.vector, integer, real, boolean)
  from public, anon, authenticated;
