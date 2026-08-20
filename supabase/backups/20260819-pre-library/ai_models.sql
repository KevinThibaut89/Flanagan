-- Backup of public.ai_models taken 2026-08-19, before the recipe-library change
-- (which adds a 'text-embedding-3-small' row). Matches
-- supabase/migrations/20260818170000_ai_models_and_usage.sql exactly — no live drift.

insert into public.ai_models (model, input_usd_per_mtok, cached_input_usd_per_mtok, output_usd_per_mtok, max_output_ceiling, is_allowed, priced_at, notes) values
  ('gpt-5-nano',   0.05, 0.005, 0.40, 16000, true,  '2026-08-18', 'Classification: cheap, fast, good enough for a slug from a list.'),
  ('gpt-5-mini',   0.25, 0.025, 2.00, 16000, true,  '2026-08-18', 'Vision on small print: shelf photos, recipe pages.'),
  ('gpt-5.6-luna', 0.20, 0.02,  1.20, 16000, true,  '2026-08-18', 'The bartender. Reasoning at a price close to nano.'),
  ('gpt-5',        1.25, 0.125, 10.00, 16000, false, '2026-08-18', 'Reference only. 8× luna on output.'),
  ('gpt-5.4-nano', 0.20, 0.02,  1.25, 16000, false, '2026-08-18', 'Reference only.'),
  ('gpt-5.4-mini', 0.75, 0.075, 4.50, 16000, false, '2026-08-18', 'Reference only.'),
  ('gpt-5.4',      2.50, 0.25,  15.00, 16000, false, '2026-08-18', 'Reference only. An Ask at the 16k ceiling would cost $0.25.')
on conflict (model) do update set
  input_usd_per_mtok = excluded.input_usd_per_mtok,
  cached_input_usd_per_mtok = excluded.cached_input_usd_per_mtok,
  output_usd_per_mtok = excluded.output_usd_per_mtok,
  max_output_ceiling = excluded.max_output_ceiling,
  is_allowed = excluded.is_allowed,
  priced_at = excluded.priced_at,
  notes = excluded.notes;
