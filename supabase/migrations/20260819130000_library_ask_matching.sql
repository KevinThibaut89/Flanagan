-- Answer-first matches asks to asks, not asks to recipes.
--
-- The first cut of the library (20260819120000) answered an Ask from the
-- library when the Ask's embedding sat close enough to a *recipe's* embedding.
-- Measured on the first real rows, that signal is too blunt: the very ask that
-- produced a Negroni scored 0.45 against it, while "refreshing long gin drink"
-- scored 0.52 against the same Negroni — the word "gin" outweighs everything
-- else. No threshold on recipe similarity separates "the same request" from
-- "mentions the same spirit".
--
-- What does separate them is comparing the new ask with *previous asks*. Two
-- phrasings of the same wish ("something bitter and stirred", "a bitter
-- stirred drink please") sit close together; a different wish does not. So:
-- keep the ask's embedding on its private `library_asks` row, and answer from
-- the library when a past ask was near enough and its recipes are makeable
-- with this bar. Recipe-embedding search stays for what it is good at — a
-- ranked reference list for the model ({{LIBRARY}}) and for Discover.

alter table public.library_asks
  add column embedding extensions.vector(1536);

create index library_asks_embedding_idx
  on public.library_asks using hnsw (embedding extensions.vector_cosine_ops);

-- ── library_upsert: also keep the ask's embedding ──────────────────────────
-- Same body as before plus one parameter, stored on every library_asks row the
-- call writes. Postgres cannot change a function's signature in place, hence
-- the drop; the service role is the only caller and is redeployed alongside.

drop function if exists public.library_upsert(uuid, text, text, integer, jsonb);

create or replace function public.library_upsert(
  p_user_id uuid,
  p_query text,
  p_model text,
  p_prompt_version integer,
  p_recipes jsonb,
  p_query_embedding extensions.vector(1536) default null
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

    insert into public.library_asks (recipe_id, user_id, query, embedding)
    values (v_id, p_user_id, p_query, p_query_embedding);

    id := v_id;
    inserted := v_inserted;
    return next;
  end loop;
end;
$$;

revoke execute on function public.library_upsert(uuid, text, text, integer, jsonb, extensions.vector)
  from public, anon, authenticated;

-- ── library_answer: recipes that answered a near-identical ask before ──────
--
-- Service role only (explicit user id, like library_search). Finds past asks
-- within p_min_similarity of the new one, collects their recipes, keeps the
-- ones this bar can make, and returns each recipe once with the best ask
-- similarity it was reached through. Ordered by that similarity, then by how
-- often the house has served it.

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
