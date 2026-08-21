# Pre-recency backup — 2026-08-21

State before the suggestion-variety change (recency-aware anti-repetition,
prompt v5, reroll button). Covers migrations `20260821120000_library_recency`
and `20260821120100_suggest_cocktails_prompt_v5` plus the redeploy of
`suggest-cocktails` and `search-library`.

## What changed

- New functions `library_recent(uuid, int, int)` (last fortnight of servings,
  for the prompt's `{{RECENT}}` block) and
  `library_record_serving(uuid, text, uuid[], vector)` (the answer-first
  shortcut now writes `library_asks` rows and bumps `times_suggested`).
- `library_answer` regrew with a fifth parameter `p_exclude_recent_days`
  (default null = old behaviour): recipes served to this person inside the
  window are excluded from the free shortcut, so a repeat ask falls through
  to fresh generation. No table or column changes.
- `ai_prompts` v5 for `suggest_cocktails`: v4 text + `{{RECENT}}` §12, the
  modern-canon list reframed as illustrative, §10's "serve the same spec"
  subordinated to a "served to them N days ago" mark. **The live v4 was NOT
  identical to the repo's `20260820120100` file** — it had been re-tuned in
  place (§4 three/five/five instead of one/three/three; §6 lost its
  "Permitted only when…" opener; md5 `bd9e16cbcaed76cfa138cea74cfae039`).
  v5 is based on the live text; the pre-change live text is snapshotted here
  as `prompt-v4-live.txt`.
- Edge functions: `suggest-cocktails/index.ts` (fourth parallel RPC, shortcut
  recording, `{{RECENT}}` substitution, recency annotation in `{{LIBRARY}}`,
  and a title-level guard — the house book holds the same drink under several
  fingerprints, so recent *titles* are filtered from both the shortcut and the
  model's output, except when the request names the drink or dropping would
  empty the answer) and `_shared/library.ts` (`LIBRARY_RECENT_*`,
  `formatRecentBlock`, `formatLibraryBlock` third param). Pre-change copies
  are in `./functions/`; all other function files were untouched.
- Client: the Ask screen's footer button is now always shown after results
  ("Pour me something different" / "Ask the Barkeep anyway"), both forcing
  `force_ai`. Pure client change, no rollback dependency.

## Rollback

1. Run `rollback.sql` (service role / dashboard SQL editor). Idempotent.
2. Redeploy `suggest-cocktails` and `search-library` with `./functions/`'s
   `index.ts` and `_shared/library.ts` over the working tree's other files.
3. The app needs nothing: the reroll button just sets `force_ai`, which the
   old function already understood. `library_asks` rows written by
   `library_record_serving` in the meantime are ordinary ask rows and can
   stay — they only make ask-matching slightly richer.
