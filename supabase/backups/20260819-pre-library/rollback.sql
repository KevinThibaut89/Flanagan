-- Rollback for the recipe-library change of 2026-08-19 (migrations
-- 20260819120000_recipe_library, 20260819120100_suggest_cocktails_prompt_v3
-- and 20260819130000_library_ask_matching).
--
-- Run this as the service role / dashboard SQL editor. It is idempotent.
-- Then redeploy the edge function from ./functions/suggest-cocktails (or from
-- git tag pre-library-20260819) and delete the `search-library` function.
-- See README.md in this folder for the full sequence.

begin;

-- 1. Prompt: back to v2, drop v3 so the unique-active constraint is clean.
update public.ai_prompts set is_active = false where key = 'suggest_cocktails' and version = 3;
update public.ai_prompts set is_active = true  where key = 'suggest_cocktails' and version = 2;
delete from public.ai_prompts where key = 'suggest_cocktails' and version = 3;

-- 2. Library RPCs (both upsert signatures: the original and the one with the
--    ask embedding added by 20260819130000).
drop function if exists public.library_answer(uuid, extensions.vector, integer, real);
drop function if exists public.library_search(uuid, extensions.vector, integer, real, boolean);
drop function if exists public.library_browse(boolean, text, integer, integer);
drop function if exists public.library_upsert(uuid, text, text, integer, jsonb, extensions.vector);
drop function if exists public.library_upsert(uuid, text, text, integer, jsonb);

-- 3. Library tables (children first; cascades would do it, explicit is clearer).
drop table if exists public.library_asks;
drop table if exists public.library_recipe_ingredients;
drop table if exists public.library_recipes;

-- 4. The embedding model's price row. Guarded by ai_models_guard_in_use, which
--    only objects if an active prompt references it — none does.
delete from public.ai_models where model = 'text-embedding-3-small';

-- 5. Optional. ai_usage rows with key embed_query / embed_recipe are harmless
--    (unmetered, pennies) and are left as a record of spend. Uncomment to purge.
-- delete from public.ai_usage where key in ('embed_query', 'embed_recipe');

-- 6. Optional. pgvector itself. Harmless to leave installed; uncomment to remove.
-- drop extension if exists vector;

commit;

-- Migration history: the two migration rows stay in supabase_migrations.schema_migrations.
-- If you want `supabase db push` to be able to re-apply them later, delete those rows:
-- delete from supabase_migrations.schema_migrations where version in ('20260819120000', '20260819120100', '20260819130000');
