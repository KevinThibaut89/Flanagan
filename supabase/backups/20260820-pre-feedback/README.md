# Pre-feedback backup — 2026-08-20

State before the suggestion-feedback change (thumbs up/down on Barkeep
suggestions, taste-tuned ranking, prompt v4). Covers migrations
`20260820120000_library_feedback` and `20260820120100_suggest_cocktails_prompt_v4`
plus the redeploy of `suggest-cocktails` and `search-library`.

## What changed

- New table `library_feedback` (user-owned votes) and column
  `recipes.library_recipe_id`.
- New function `library_taste_profile(uuid)`.
- `library_answer` and `library_search` re-ranked: downvoted recipes excluded,
  likes and flavour-tag affinity nudge the order.
- `ai_prompts` v4 for `suggest_cocktails`: v3 text + `{{TASTE}}` section. The
  live v3 was verified identical to the repo's `20260819120100` file
  (md5 `0927f5ebcab77cdd6465acb0b49d0439`) before v4 was based on it, so no
  separate prompt snapshot is kept here — the repo file *is* the snapshot.
- Edge functions: `suggest-cocktails/index.ts` (returns `library_recipe_id`,
  injects `{{TASTE}}`, drops re-invented downvoted drinks) and
  `_shared/library.ts` (`libraryRowToDraft` id, `formatTasteBlock`). Pre-change
  copies are in `./functions/`; all other function files were untouched.

## Rollback

1. Run `rollback.sql` (service role / dashboard SQL editor). Idempotent.
2. Redeploy `suggest-cocktails` and `search-library` with `./functions/`'s
   `index.ts` and `_shared/library.ts` over the working tree's other files.
3. The app mostly needs nothing: without `library_recipe_id` in responses the
   thumbs never render, and Ask-screen saves stop carrying the column on their
   own. Two client spots set it unconditionally and would error against a
   database without the column until the client commit is reverted:
   `libraryToDraft` (`src/data/library.ts`) and the vote hooks
   (`src/data/feedback.ts`, unreachable once the thumbs are hidden).
