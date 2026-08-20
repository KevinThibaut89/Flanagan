-- Rollback for the suggestion-feedback change of 2026-08-20 (migrations
-- 20260820120000_library_feedback and 20260820120100_suggest_cocktails_prompt_v4).
--
-- Run as the service role / dashboard SQL editor. It is idempotent. Then
-- redeploy suggest-cocktails and search-library from ./functions in this
-- folder (index.ts + _shared/library.ts are the only files that changed; take
-- the rest from the working tree). The app tolerates every step: a missing
-- library_recipe_id hides the thumbs, and useSaveRecipe only sends the column
-- when the draft carries it.

begin;

-- 1. Prompt: back to v3, drop v4 so the unique-active constraint is clean.
update public.ai_prompts set is_active = false where key = 'suggest_cocktails' and version = 4;
update public.ai_prompts set is_active = true  where key = 'suggest_cocktails' and version = 3;
delete from public.ai_prompts where key = 'suggest_cocktails' and version = 4;

-- 2. The taste profile function.
drop function if exists public.library_taste_profile(uuid);

-- 3. library_answer and library_search: restore the pre-feedback bodies
--    (verbatim from 20260819130000_library_ask_matching.sql and
--    20260819120000_recipe_library.sql).

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
  where r.required_ingredient_ids <@ avail.ids
  order by n.similarity desc, r.times_suggested desc, r.created_at desc
  limit greatest(1, least(coalesce(p_count, 3), 10));
$$;

revoke execute on function public.library_answer(uuid, extensions.vector, integer, real)
  from public, anon, authenticated;

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

-- 4. The votes and the saved-recipe link (drops their policies and indexes).
drop table if exists public.library_feedback;
alter table public.recipes drop column if exists library_recipe_id;

commit;

-- Migration history: the two rows stay in supabase_migrations.schema_migrations.
-- If you want `supabase db push` to be able to re-apply them later, delete them:
-- delete from supabase_migrations.schema_migrations where version in ('20260820120000', '20260820120100');
