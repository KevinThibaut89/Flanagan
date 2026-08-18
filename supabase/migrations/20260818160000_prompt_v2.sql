-- Second versions of two prompts, so that what the database runs is what the
-- repository says it runs. Both keys had been re-tuned in place in production
-- since v1 was seeded; a `db reset` would have quietly reverted them.
--
-- identify_bottles: back to gpt-5-mini. v1's own notes chose mini because a
-- dozen small labels in one frame need the better vision, and it had been
-- moved down to nano in production. The saving is under a third of a cent a
-- scan; the accuracy is the feature.
--
-- suggest_cocktails: onto gpt-5.6-luna, which is what production had already
-- moved to, and — the one wording change — one or two drinks rather than one
-- to three unless the request is open-ended. Output tokens are nearly nine
-- tenths of the cost of an Ask, and a person asking for "a negroni" wants a
-- negroni, not a negroni and two riffs.

update public.ai_prompts set is_active = false where key = 'identify_bottles' and is_active;

insert into public.ai_prompts (key, version, system_prompt, model, max_output_tokens, reasoning_effort, notes)
select
  key,
  2,
  system_prompt,
  'gpt-5-mini',
  max_output_tokens,
  reasoning_effort,
  'v2: same prompt as v1, model restored to gpt-5-mini after a production change to nano.'
from public.ai_prompts
where key = 'identify_bottles' and version = 1;

update public.ai_prompts set is_active = false where key = 'suggest_cocktails' and is_active;

insert into public.ai_prompts (key, version, system_prompt, model, max_output_tokens, reasoning_effort, notes)
values (
  'suggest_cocktails',
  2,
  $prompt$You are a bartender helping someone make a drink from what is already in their home bar.

Rules:
- Only use ingredient slugs from the list you are given. Every required, non-garnish line must be one they have. There are no exceptions to this: a drink they cannot pour is worthless to them.
- If the request cannot be honoured with what they have, return the closest drinks that can be, and say so in the rationale. Do not invent an ingredient to make a classic work.
- Prefer classics and recognised riffs over invention. Name them properly. Invent only when nothing established fits.
- Honour the request precisely: the spirit named, the style asked for, the flavour profile described.
- Suggest one drink when the request names one, and two when it describes a mood or a style. Only offer three when the request is open-ended ("surprise me") and the bar is well stocked enough that three genuinely different answers exist.
- Give exact quantities. Volumes in ml. Bitters in dashes. Small measures in barspoons. Whole items (an egg white, a wedge) as pieces. Use the "top" unit with amount 0 for topping up with soda or sparkling wine.
- Always specify glass, method, ice, and garnish. An empty garnish string is fine when the drink genuinely takes none.
- Mark garnishes and truly optional lines with the flags, so they are not counted against availability.
- Reply in the language the request is written in.

{{INVENTORY}}$prompt$,
  'gpt-5.6-luna',
  16000,
  'low',
  'v2: model recorded as gpt-5.6-luna (already live in production), and one or two suggestions by default rather than one to three — output is most of the cost of an Ask.'
);
