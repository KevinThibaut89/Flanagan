-- Two things the pricing plan needs and the AI call sites did not have: a
-- list of models we have actually costed, and a record of what each call spent.
--
-- `ai_models` is the guardrail. `ai_prompts.model` was free text, which is the
-- flexibility the table exists for — and also the one thing that could break
-- the economics: the same Ask costs $0.004 on gpt-5.6-luna and $0.25 on
-- gpt-5.4 at the same 16k-token ceiling, and that swing was one UPDATE away
-- with no deploy and no review. Now a prompt may only reference a model that
-- has a row here, that is marked allowed, and its output ceiling may not
-- exceed what that row permits. Prices are kept alongside so a call's cost is
-- computable in SQL, not in a spreadsheet.
--
-- `ai_usage` is one row per model call: who, which prompt, how many tokens,
-- what it cost. The edge functions already logged this to the console; this
-- persists it, so fair-use limits can be enforced (see plan_limits) and the
-- projections behind the price list can be replaced with real numbers.

create table public.ai_models (
  model text primary key,
  -- OpenAI list prices in USD per million tokens. Cached input is null for
  -- models that do not offer prompt caching.
  input_usd_per_mtok numeric(10, 4) not null check (input_usd_per_mtok >= 0),
  cached_input_usd_per_mtok numeric(10, 4) check (cached_input_usd_per_mtok >= 0),
  output_usd_per_mtok numeric(10, 4) not null check (output_usd_per_mtok >= 0),
  -- The most any prompt using this model may set as max_output_tokens.
  max_output_ceiling integer not null default 16000 check (max_output_ceiling > 0),
  -- False for models kept here for reference (so the price of a switch is
  -- visible) that no prompt is allowed to use.
  is_allowed boolean not null default true,
  priced_at date not null default current_date,
  notes text
);

comment on table public.ai_models is
  'Models the AI call sites may use, with the list prices they were costed at. ai_prompts.model must reference an allowed row.';

insert into public.ai_models (model, input_usd_per_mtok, cached_input_usd_per_mtok, output_usd_per_mtok, max_output_ceiling, is_allowed, priced_at, notes) values
  ('gpt-5-nano',   0.05, 0.005, 0.40, 16000, true,  '2026-08-18', 'Classification: cheap, fast, good enough for a slug from a list.'),
  ('gpt-5-mini',   0.25, 0.025, 2.00, 16000, true,  '2026-08-18', 'Vision on small print: shelf photos, recipe pages.'),
  ('gpt-5.6-luna', 0.20, 0.02,  1.20, 16000, true,  '2026-08-18', 'The bartender. Reasoning at a price close to nano.'),
  -- Reference rows: not allowed, kept so the cost of switching is a SELECT away.
  ('gpt-5',        1.25, 0.125, 10.00, 16000, false, '2026-08-18', 'Reference only. 8× luna on output.'),
  ('gpt-5.4-nano', 0.20, 0.02,  1.25, 16000, false, '2026-08-18', 'Reference only.'),
  ('gpt-5.4-mini', 0.75, 0.075, 4.50, 16000, false, '2026-08-18', 'Reference only.'),
  ('gpt-5.4',      2.50, 0.25,  15.00, 16000, false, '2026-08-18', 'Reference only. An Ask at the 16k ceiling would cost $0.25.');

-- ── Enforce it on ai_prompts ───────────────────────────────────────────────

alter table public.ai_prompts
  add constraint ai_prompts_model_fkey
  foreign key (model) references public.ai_models (model);

create or replace function public.ai_prompts_check_model()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m public.ai_models%rowtype;
begin
  select * into m from public.ai_models where model = new.model;
  if not found then
    raise exception 'ai_prompts.model "%" has no ai_models row; add it with its prices first', new.model;
  end if;
  if not m.is_allowed then
    raise exception 'ai_prompts.model "%" is not allowed (see ai_models.is_allowed)', new.model;
  end if;
  if new.max_output_tokens > m.max_output_ceiling then
    raise exception 'ai_prompts.max_output_tokens % exceeds the % ceiling for %',
      new.max_output_tokens, m.max_output_ceiling, new.model;
  end if;
  return new;
end;
$$;

create trigger ai_prompts_check_model
  before insert or update of model, max_output_tokens on public.ai_prompts
  for each row execute function public.ai_prompts_check_model();

-- The other direction: a model in use by a live prompt cannot be disallowed
-- out from under it. Deactivate or re-point the prompt first.
create or replace function public.ai_models_guard_in_use()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' or not new.is_allowed)
     and exists (select 1 from public.ai_prompts where model = old.model and is_active) then
    raise exception 'ai_models "%" is used by an active ai_prompts row', old.model;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ai_models_guard_in_use
  before update of is_allowed or delete on public.ai_models
  for each row execute function public.ai_models_guard_in_use();

alter table public.ai_models enable row level security;
-- No policies: read and written by the service role only, like ai_prompts.

-- ── Usage ──────────────────────────────────────────────────────────────────

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The ai_prompts key: 'suggest_cocktails', 'identify_bottles', ...
  key text not null,
  model text not null,
  prompt_version integer,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  -- Subset of input_tokens served from the prompt cache, priced lower.
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Filled from ai_models prices by trigger when not supplied.
  cost_usd numeric(12, 8) not null default 0 check (cost_usd >= 0),
  -- ok: a usable answer. refused/incomplete: the model declined or truncated,
  -- which still cost tokens and still counts against a monthly allowance.
  status text not null default 'ok' check (status in ('ok', 'refused', 'incomplete')),
  created_at timestamptz not null default now()
);

comment on table public.ai_usage is
  'One row per model call made on a user''s behalf. Counts against plan_limits; cost is derived from ai_models.';

create index ai_usage_user_key_created_idx on public.ai_usage (user_id, key, created_at desc);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

create or replace function public.ai_usage_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m public.ai_models%rowtype;
begin
  if new.cost_usd <> 0 then return new; end if;
  select * into m from public.ai_models where model = new.model;
  if not found then return new; end if;
  new.cost_usd :=
    ( greatest(new.input_tokens - new.cached_input_tokens, 0) * m.input_usd_per_mtok
    + new.cached_input_tokens * coalesce(m.cached_input_usd_per_mtok, m.input_usd_per_mtok)
    + new.output_tokens * m.output_usd_per_mtok
    ) / 1000000.0;
  return new;
end;
$$;

create trigger ai_usage_price
  before insert on public.ai_usage
  for each row execute function public.ai_usage_price();

alter table public.ai_usage enable row level security;

-- A person may see their own usage (the app shows "N asks left this month").
-- Only the service role inserts, from inside the edge functions.
create policy "users read their own ai usage"
  on public.ai_usage for select
  to authenticated
  using ((select auth.uid()) = user_id);
