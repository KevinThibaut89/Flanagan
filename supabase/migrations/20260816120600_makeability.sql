-- "What can I make right now?"
--
-- A recipe line asking for `gin` must be satisfied by a bottle of
-- `london-dry-gin`, so availability is computed by walking each owned
-- ingredient *upward* through its parent chain and collecting every ancestor.
-- Owning a specific gin therefore makes the generic `gin` available, but owning
-- generic `gin` does not make `old-tom-gin` available — which is the correct
-- asymmetry.

create or replace function public.available_ingredient_ids(p_user_id uuid)
returns table (ingredient_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive owned as (
    select distinct b.ingredient_id as id
    from public.bottles b
    where b.user_id = p_user_id
      and b.status = 'in_stock'
      and b.ingredient_id is not null
  ),
  chain as (
    select o.id from owned o
    union
    select i.parent_id
    from chain c
    join public.ingredients i on i.id = c.id
    where i.parent_id is not null
  )
  select distinct c.id from chain c;
$$;

-- A recipe is makeable when every required line — non-optional and
-- non-garnish — resolves to something in that set.
--
-- A line with only free text counts as *not* satisfied: the app cannot verify
-- something it has no canonical id for, and quietly assuming availability is
-- worse than under-reporting.
create or replace function public.can_make(p_recipe_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1
    from public.recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
      and not ri.is_optional
      and not ri.is_garnish
      and (
        ri.ingredient_id is null
        or ri.ingredient_id not in (
          select a.ingredient_id from public.available_ingredient_ids(p_user_id) a
        )
      )
  );
$$;

-- Convenience wrapper for the app: the caller is always the current user.
create or replace function public.my_makeable_recipe_ids()
returns table (recipe_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with available as (
    select a.ingredient_id from public.available_ingredient_ids((select auth.uid())) a
  )
  select r.id
  from public.recipes r
  where r.user_id = (select auth.uid())
    and not exists (
      select 1
      from public.recipe_ingredients ri
      where ri.recipe_id = r.id
        and not ri.is_optional
        and not ri.is_garnish
        and (
          ri.ingredient_id is null
          or ri.ingredient_id not in (select ingredient_id from available)
        )
    );
$$;
