-- Plans. Two tiers — free and Plus — a table of monthly allowances per tier
-- and call site, and the two functions that read them: one the edge functions
-- call before spending money, one the app calls to show what is left.
--
-- Same philosophy as ai_prompts: the numbers live in a table so they can be
-- tuned with an UPDATE. The plan itself is simple on purpose. Nobody is
-- expensive — the heaviest plausible user costs under twenty cents of tokens
-- a month — so limits are not there to recover cost. The free allowance is
-- there to be enough to understand what the app is for and not enough for a
-- Friday night, and the Plus allowance is there to stop one pathological
-- account, at a level nobody real ever meets.

create type public.plan_tier as enum ('free', 'plus');

-- ── Which plan a person is on ──────────────────────────────────────────────

alter table public.profiles
  add column tier public.plan_tier not null default 'free',
  -- Null on free, and on a lifetime purchase. Otherwise the end of the paid
  -- period as last reported by the store; a lapsed date means free.
  add column plus_expires_at timestamptz,
  -- 'revenuecat' when a store receipt set it, 'manual' for comps and testing.
  add column entitlement_source text
    check (entitlement_source in ('revenuecat', 'manual')),
  add column entitlement_updated_at timestamptz;

comment on column public.profiles.tier is
  'Set by the RevenueCat webhook (or by hand). Not writable by the user: see the column grants below.';

-- Users may update their own profile row (see the profiles migration) — but
-- not these columns. Column-level grants are the cleanest way to say so:
-- revoke the blanket update, grant back exactly the fields the app edits.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, unit_preference) on public.profiles to authenticated;

-- ── Allowances ─────────────────────────────────────────────────────────────

create table public.plan_limits (
  tier public.plan_tier not null,
  -- The ai_prompts key.
  key text not null,
  -- Calls per calendar month (UTC). Null means unlimited.
  monthly_limit integer check (monthly_limit is null or monthly_limit >= 0),
  primary key (tier, key)
);

comment on table public.plan_limits is
  'Monthly call allowances per tier and AI call site. Null = unlimited. Read by check_ai_quota.';

insert into public.plan_limits (tier, key, monthly_limit) values
  -- Free: the whole bar, and a taste of the bartender.
  ('free', 'suggest_cocktails', 5),
  ('free', 'identify_bottles',  1),
  ('free', 'read_recipe',       3),
  ('free', 'classify_bottle',   null),
  -- Plus: five asks a day, every day — past any real use, and it caps a
  -- runaway account at well under a dollar of tokens.
  ('plus', 'suggest_cocktails', 150),
  ('plus', 'identify_bottles',  20),
  ('plus', 'read_recipe',       25),
  ('plus', 'classify_bottle',   null);

alter table public.plan_limits enable row level security;

-- The paywall shows the allowances, so anyone signed in may read them.
create policy "signed-in users read plan limits"
  on public.plan_limits for select
  to authenticated
  using (true);

-- ── What tier is this person effectively on? ───────────────────────────────

create or replace function public.effective_tier(p_user_id uuid)
returns public.plan_tier
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.tier = 'plus' and (p.plus_expires_at is null or p.plus_expires_at > now())
      then 'plus'::public.plan_tier
    else 'free'::public.plan_tier
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

revoke execute on function public.effective_tier(uuid) from public, anon, authenticated;

-- ── The check the edge functions make before calling OpenAI ────────────────
--
-- Not a reservation: it reads the month's count and answers. The row that
-- actually counts is inserted into ai_usage after the model responds, so a
-- call that never reaches OpenAI (network error, config error) is not charged
-- to the person. Two requests racing past the same last slot is accepted —
-- the worst case is one extra call at a fraction of a cent.

create or replace function public.check_ai_quota(p_user_id uuid, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tier public.plan_tier;
  v_limit integer;
  v_has_row boolean;
  v_used integer;
  v_period_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  v_tier := coalesce(public.effective_tier(p_user_id), 'free');

  select true, monthly_limit into v_has_row, v_limit
  from public.plan_limits
  where tier = v_tier and key = p_key;

  -- A key with no row is not metered. That is deliberate: a new call site
  -- should work before someone remembers to price it, and show up in ai_usage
  -- so that they do.
  if v_has_row is null then
    return jsonb_build_object(
      'allowed', true, 'tier', v_tier, 'used', 0, 'limit', null, 'remaining', null,
      'resets_at', v_period_start + interval '1 month');
  end if;

  select count(*) into v_used
  from public.ai_usage
  where user_id = p_user_id and key = p_key and created_at >= v_period_start;

  return jsonb_build_object(
    'allowed', v_limit is null or v_used < v_limit,
    'tier', v_tier,
    'used', v_used,
    'limit', v_limit,
    'remaining', case when v_limit is null then null else greatest(v_limit - v_used, 0) end,
    'resets_at', v_period_start + interval '1 month');
end;
$$;

revoke execute on function public.check_ai_quota(uuid, text) from public, anon, authenticated;

-- ── What the app shows ─────────────────────────────────────────────────────
--
-- The signed-in person's tier and, for every metered call site, how much of
-- this month's allowance is used. One round trip for the Ask screen's
-- "4 asks left", the paywall, and the settings row.

create or replace function public.my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tier public.plan_tier;
  v_period_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_profile record;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  v_tier := coalesce(public.effective_tier(v_uid), 'free');
  select plus_expires_at, entitlement_source into v_profile from public.profiles where id = v_uid;

  return jsonb_build_object(
    'tier', v_tier,
    'plus_expires_at', v_profile.plus_expires_at,
    'entitlement_source', v_profile.entitlement_source,
    'resets_at', v_period_start + interval '1 month',
    'quotas', (
      select coalesce(jsonb_object_agg(l.key, jsonb_build_object(
        'used', coalesce(u.used, 0),
        'limit', l.monthly_limit,
        'remaining', case when l.monthly_limit is null then null
                          else greatest(l.monthly_limit - coalesce(u.used, 0), 0) end
      )), '{}'::jsonb)
      from public.plan_limits l
      left join (
        select key, count(*)::integer as used
        from public.ai_usage
        where user_id = v_uid and created_at >= v_period_start
        group by key
      ) u on u.key = l.key
      where l.tier = v_tier
    ),
    -- Both tiers' allowances, so the paywall can say what Plus adds.
    'limits', (
      select coalesce(jsonb_object_agg(tier || ':' || key, monthly_limit), '{}'::jsonb)
      from public.plan_limits
    )
  );
end;
$$;

revoke execute on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;
