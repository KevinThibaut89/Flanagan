-- Backup of public.plan_limits taken 2026-08-19, before the recipe-library change
-- (which does not touch this table; kept for completeness). Matches
-- supabase/migrations/20260818180000_plans_and_quota.sql exactly — no live drift.

insert into public.plan_limits (tier, key, monthly_limit) values
  ('free', 'suggest_cocktails', 5),
  ('free', 'identify_bottles',  1),
  ('free', 'read_recipe',       3),
  ('free', 'classify_bottle',   null),
  ('plus', 'suggest_cocktails', 150),
  ('plus', 'identify_bottles',  20),
  ('plus', 'read_recipe',       25),
  ('plus', 'classify_bottle',   null)
on conflict (tier, key) do update set monthly_limit = excluded.monthly_limit;
