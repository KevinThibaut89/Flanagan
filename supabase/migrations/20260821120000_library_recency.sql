-- Variety: the Barkeep stops serving the same drink twice in a fortnight.
--
-- Suggestions had become samey — one drink (the White Negroni, as it happens)
-- answered half the asks. Three mechanisms reinforced each other and nothing
-- pushed back: the prompt's fixed "modern canon" list, a {{LIBRARY}} grounding
-- block whose "asked N×" count reads as an endorsement, and the answer-first
-- shortcut returning byte-identical rows for every near-paraphrase, with
-- `times_suggested desc` as an explicit popularity tiebreak.
--
-- The per-user serving history already existed — `library_asks`, one row per
-- recipe per ask, indexed (user_id, created_at desc) — it was just never read
-- for anti-repetition. This migration threads it in:
--
--   1. `library_recent` returns what this person was served in the last
--      fortnight; the edge function renders it into the prompt's new
--      {{RECENT}} block (prompt v5, 20260821120100) as a *soft* steer — the
--      model may still serve a repeat when the request names it or nothing
--      else honestly answers.
--   2. `library_answer` grows `p_exclude_recent_days` (default null = old
--      behaviour, so the already-deployed function keeps working between
--      migration and redeploy). With it set, recipes served to this person
--      inside the window are excluded from the free shortcut, so a repeat
--      ask falls through to fresh generation instead of the same rows.
--      Accepted trade-off: some asks that used to be answered free now spend
--      an AI ask — that is the price of variety, chosen deliberately.
--   3. `library_record_serving` makes the shortcut path leave a trace: until
--      now only the AI path (via library_upsert) wrote `library_asks`, so a
--      drink served from the library was invisible to recency — and to the
--      "asked N×" count, which it now honestly bumps. The extra ask rows also
--      enrich ask-matching for everyone: free paraphrase data.
--
-- `library_search` is deliberately untouched: grounding and Discover want
-- recent drinks visible (the prompt annotates them), not hidden. The
-- `times_suggested desc` tiebreak in library_answer also stays — it is a
-- useful global quality prior, and per-user exclusion makes it moot for the
-- repeat case. Rollback kit: supabase/backups/20260821-pre-recency/.

-- ── What they were served lately, for the prompt ─────────────────────────────
-- Service role only, like library_taste_profile: explicit user id, must never
-- be reachable with a spoofable one. Served straight off the
-- library_asks (user_id, created_at desc) index.

create or replace function public.library_recent(
  p_user_id uuid,
  p_days integer default 14,
  p_max integer default 12
)
returns table (
  recipe_id uuid,
  title text,
  last_served_at timestamptz,
  times_served bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.recipe_id, r.title, max(a.created_at) as last_served_at, count(*) as times_served
  from public.library_asks a
  join public.library_recipes r on r.id = a.recipe_id
  where a.user_id = p_user_id
    and a.created_at >= now() - make_interval(days => greatest(1, coalesce(p_days, 14)))
  group by a.recipe_id, r.title
  order by max(a.created_at) desc
  limit greatest(1, least(coalesce(p_max, 12), 50));
$$;

revoke execute on function public.library_recent(uuid, integer, integer)
  from public, anon, authenticated;

-- ── The shortcut path leaves a trace ─────────────────────────────────────────
-- Mirrors what library_upsert does for the AI path: one library_asks row per
-- recipe served, and an honest bump of the serve counters.

create or replace function public.library_record_serving(
  p_user_id uuid,
  p_query text,
  p_recipe_ids uuid[],
  p_query_embedding extensions.vector(1536) default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.library_asks (recipe_id, user_id, query, embedding)
  select rid, p_user_id, p_query, p_query_embedding
  from unnest(p_recipe_ids) as rid;

  update public.library_recipes
  set times_suggested = times_suggested + 1,
      last_suggested_at = now()
  where id = any(p_recipe_ids);
$$;

revoke execute on function public.library_record_serving(uuid, text, uuid[], extensions.vector)
  from public, anon, authenticated;

-- ── library_answer: not the same drink twice in the window ───────────────────
-- Postgres cannot add a parameter in place (the signature is the identity), so
-- drop and recreate — same precedent as 20260819130000. Body is verbatim from
-- 20260820120000_library_feedback.sql (taste CTE, downvote exclusion, nudged
-- ordering all unchanged) plus the one recency predicate.

drop function if exists public.library_answer(uuid, extensions.vector, integer, real);

create or replace function public.library_answer(
  p_user_id uuid,
  p_embedding extensions.vector(1536),
  p_count integer default 3,
  p_min_similarity real default 0.8,
  p_exclude_recent_days integer default null
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
    and (p_exclude_recent_days is null or not exists (
      select 1 from public.library_asks ra
      where ra.user_id = p_user_id
        and ra.recipe_id = r.id
        and ra.created_at >= now() - make_interval(days => p_exclude_recent_days)
    ))
  order by
    ( n.similarity
      + case when f.vote = 1 then 0.04 else 0 end
      + greatest(-0.05, least(0.05, 0.01 * coalesce(
          (select sum(t.weight) from taste t where t.tag = any(r.flavor_tags)), 0)))
    ) desc,
    r.times_suggested desc, r.created_at desc
  limit greatest(1, least(coalesce(p_count, 3), 10));
$$;

revoke execute on function public.library_answer(uuid, extensions.vector, integer, real, integer)
  from public, anon, authenticated;
