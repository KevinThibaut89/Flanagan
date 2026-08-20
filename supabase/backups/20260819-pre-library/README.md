# Pre-library backup — 2026-08-19

State of everything the **shared recipe library** change touches, captured
immediately before it was applied. Git tag `pre-library-20260819` marks the
matching commit (clean tree, HEAD `e96dee0`).

| File | What | Live drift vs. migrations? |
|---|---|---|
| `ai_prompts.sql` | Every `ai_prompts` row, upsert form. md5 of each `system_prompt` verified against the live rows. | **Yes** — `suggest_cocktails` v2 had been edited in place (6,880 chars, md5 `010ba04f53a8109c170dbaa804800559`); the file `20260818160000_prompt_v2.sql` is stale. This backup is the source of truth for v2. |
| `ai_models.sql` | Every `ai_models` row, upsert form. | No. |
| `plan_limits.sql` | Every `plan_limits` row, upsert form (not changed by the feature; completeness). | No. |
| `functions/suggest-cocktails/*`, `functions/_shared/{quota,http}.ts`, `functions/deno.json` | Source of the deployed function. Deployed version **5**, `ezbr_sha256 e49200178cf8…2454e336`, `verify_jwt: true`; content matched the working tree. | No. |
| `database.types.backup.ts` | `src/types/database.ts` before regeneration. | — |
| `rollback.sql` | One idempotent script that undoes the database side (all three migrations: `recipe_library`, `suggest_cocktails_prompt_v3`, `library_ask_matching`). | — |

## Rollback

1. **Database** — run `rollback.sql` (dashboard SQL editor or `psql`). It
   restores v2 as the active prompt, drops the `library_*` tables and RPCs,
   and removes the embedding model's price row. Re-run `ai_prompts.sql` too
   if you want belt and braces (it upserts exactly these rows).
2. **Edge function** — redeploy `suggest-cocktails` from
   `functions/suggest-cocktails` here (with `functions/_shared/*` and
   `functions/deno.json` alongside) or from the tag:
   `git checkout pre-library-20260819 -- supabase/functions && supabase functions deploy suggest-cocktails`.
3. **New function** — `supabase functions delete search-library`.
   (`suggest-cocktails` went from deployed version 5 to 10 during this work;
   `search-library` is at version 3.)
4. **App** — `git checkout pre-library-20260819 -- src app README.md`, or
   at minimum restore `src/types/database.ts` from `database.types.backup.ts`.
   Old clients keep working against the new backend regardless (`from_library`
   is additive, `force_ai` optional), so the app can lag the database.
