-- Rollback for the suggestion-variety change of 2026-08-21 (migrations
-- 20260821120000_library_recency and 20260821120100_suggest_cocktails_prompt_v5).
--
-- Run as the service role / dashboard SQL editor. It is idempotent. Then
-- redeploy suggest-cocktails and search-library from ./functions in this
-- folder (index.ts + _shared/library.ts are the only files that changed; take
-- the rest from the working tree). The app tolerates every step: the reroll
-- button only sets force_ai, which the old function already understood.
-- library_asks rows written by library_record_serving may stay — they are
-- ordinary ask rows.

begin;

-- 1. Prompt: back to v4 (the live, in-place-edited v4 — see prompt-v4-live.txt
--    in this folder; the row itself was never touched), drop v5.
update public.ai_prompts set is_active = false where key = 'suggest_cocktails' and version = 5;
update public.ai_prompts set is_active = true  where key = 'suggest_cocktails' and version = 4;
delete from public.ai_prompts where key = 'suggest_cocktails' and version = 5;

-- 2. The recency helpers.
drop function if exists public.library_recent(uuid, integer, integer);
drop function if exists public.library_record_serving(uuid, text, uuid[], extensions.vector);

-- 3. library_answer: back to the four-parameter signature and body, verbatim
--    from 20260820120000_library_feedback.sql.

drop function if exists public.library_answer(uuid, extensions.vector, integer, real, integer);

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

commit;
