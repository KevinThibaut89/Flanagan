-- Prompt and model configuration for the AI call sites, so tuning the bartender
-- is an UPDATE rather than a code change, a commit, and a function redeploy.
--
-- Rows are versioned rather than edited in place: insert a new version, flip
-- `is_active`, and the old wording is still there to compare against or roll
-- back to. A partial unique index makes "which prompt is live" a fact rather
-- than a matter of ordering.

create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),

  -- Which call site this configures, e.g. 'suggest_cocktails'.
  key text not null,
  version integer not null default 1 check (version > 0),

  -- The system prompt sent to the model. `{{INVENTORY}}` is substituted with the
  -- drinker's available ingredient list before the call; a prompt without the
  -- placeholder gets the list appended instead, because a prompt with no
  -- inventory would fail every availability check downstream.
  system_prompt text not null,

  model text not null,
  max_output_tokens integer not null default 16000 check (max_output_tokens > 0),
  -- Reasoning models only. Null means the parameter is omitted entirely, which
  -- is what a non-reasoning model needs — passing it to one is an error.
  reasoning_effort text check (reasoning_effort in ('minimal', 'low', 'medium', 'high')),

  is_active boolean not null default true,
  -- Room to record why a version exists, for whoever compares two of them later.
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ai_prompts_key_version_idx on public.ai_prompts (key, version);
create unique index ai_prompts_one_active_per_key_idx
  on public.ai_prompts (key) where is_active;

create trigger ai_prompts_touch_updated_at
  before update on public.ai_prompts
  for each row execute function public.touch_updated_at();

-- RLS on with no policies at all, which denies anon and authenticated outright.
-- This is deliberate, not an oversight: the only reader is the service-role
-- client inside `suggest-cocktails`, which bypasses RLS, and there is no reason
-- to make the system prompt readable by every signed-in user. Do not add a
-- select policy without a client that actually needs one.
alter table public.ai_prompts enable row level security;

insert into public.ai_prompts (key, version, system_prompt, model, max_output_tokens, reasoning_effort, notes)
values (
  'suggest_cocktails',
  1,
  $prompt$You are a bartender helping someone make a drink from what is already in their home bar.

Rules:
- Only use ingredient slugs from the list you are given. Every required, non-garnish line must be one they have. There are no exceptions to this: a drink they cannot pour is worthless to them.
- If the request cannot be honoured with what they have, return the closest drinks that can be, and say so in the rationale. Do not invent an ingredient to make a classic work.
- Prefer classics and recognised riffs over invention. Name them properly. Invent only when nothing established fits.
- Honour the request precisely: the spirit named, the style asked for, the flavour profile described.
- Give exact quantities. Volumes in ml. Bitters in dashes. Small measures in barspoons. Whole items (an egg white, a wedge) as pieces. Use the "top" unit with amount 0 for topping up with soda or sparkling wine.
- Always specify glass, method, ice, and garnish. An empty garnish string is fine when the drink genuinely takes none.
- Mark garnishes and truly optional lines with the flags, so they are not counted against availability.
- Reply in the language the request is written in.

{{INVENTORY}}$prompt$,
  'gpt-5-nano',
  16000,
  'low',
  'Initial version: the prompt as it was hardcoded in the edge function, moved here unchanged.'
);
