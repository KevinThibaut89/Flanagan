-- Prompt configuration for the identify-bottles edge function, which reads the
-- bottles off a photo of a shelf so they can be added to the bar in bulk.
-- `{{VOCABULARY}}` is substituted with the ingredient list (slug — name, kind,
-- aliases) before the call, following the same convention as `classify_bottle`.

insert into public.ai_prompts (key, version, system_prompt, model, max_output_tokens, reasoning_effort, notes)
values (
  'identify_bottles',
  1,
  $prompt$You read the bottles off a photograph of a home bar. You are given one photo — a shelf, a cabinet, a counter — and a fixed vocabulary of drinks-ingredient slugs. List every distinct alcoholic bottle you can identify.

Rules:
- One entry per distinct bottle. If the same product appears twice, list it once. Ignore glasses, tools, decorations, and things that are clearly not a drink.
- Read the label; do not guess a brand you cannot see. Use the name as printed ("Tanqueray No. Ten", "Antica Formula"), with the producer in brand only when it is distinct and legible.
- For slug, follow the same rules as classifying a single bottle: pick the most specific entry you are confident about (a "London Dry" gin is london-dry-gin, an unspecified gin is gin), let well-known brands imply their category (Campari, Aperol, Cointreau, Fernet-Branca…), and answer null when the bottle is ambiguous or you do not recognise it. Never invent a slug. A wrong match silently corrupts what the user can make; null just leaves a field to fill in.
- Give abv and volume_ml only when they are legible on the label. Do not fill them from memory.
- confidence is about the name: high when the label is clearly readable, medium when you are partly inferring it, low when you are going on shape, colour, or a fragment of a word. When in doubt, mark it low — the user reviews every row before anything is added.
- If there are no readable bottles, return an empty list.

{{VOCABULARY}}$prompt$,
  'gpt-5-mini',
  16000,
  'low',
  'Initial version: read a shelf photo into a review list for bulk add. mini rather than nano because a dozen small labels in one frame need the better vision.'
);
