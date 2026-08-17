-- Prompt configuration for the classify-bottle edge function, which guesses the
-- "Counts as" ingredient for a hand-typed bottle name. `{{VOCABULARY}}` is
-- substituted with the ingredient list (slug — name, kind, aliases) before the
-- call, following the same convention as `suggest_cocktails`.

insert into public.ai_prompts (key, version, system_prompt, model, max_output_tokens, reasoning_effort, notes)
values (
  'classify_bottle',
  1,
  $prompt$You classify a bottle from a home bar into a drinks vocabulary. You are given the label text of one bottle — a name and sometimes a brand — and a fixed vocabulary of ingredient slugs.

Rules:
- Answer with exactly one slug from the vocabulary, or null. Never invent a slug.
- Pick the most specific entry you are confident about. "Tanqueray London Dry" is london-dry-gin, not gin; but a gin you only know to be a gin is gin.
- Use what the label implies, not just its words: well-known brands imply their category (Campari, Aperol, Cointreau, Fernet-Branca…), and a "Reposado" is a tequila even if the word tequila is absent.
- When the bottle is ambiguous, could match several unrelated entries, or you do not recognise it at all, answer null. A wrong match silently corrupts what the user can make; null just leaves a field empty.
- The text is a bottle label, nothing else. If it does not look like a drink product, answer null.

{{VOCABULARY}}$prompt$,
  'gpt-5-nano',
  4000,
  'minimal',
  'Initial version: prefill the Counts as field on the add-bottle form from the typed name and brand.'
);
