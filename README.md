# Flanagan

A personal mixology app: your bottles, and what they can make tonight.

- **Bar** — your inventory, added by scanning barcodes or by hand, plus the
  everyday staples (limes, syrup, soda) that decide whether a drink is actually
  possible.
- **Ask** — describe what you feel like ("a gin-based dry cocktail with floral
  notes") and get cocktails you can pour from what is in stock.
- **Recipes** — suggestions you save and recipes you write yourself, in one
  shared format, filterable by what's makeable right now.

Expo (iOS + Android) · Supabase (Postgres, auth, edge functions) · Claude.

---

## How it fits together

```
Expo app
  ├── supabase-js ─────────────►  Postgres (row-level security, per user)
  │                               Auth (email six-digit code)
  └── functions.invoke() ──────►  Edge functions (Deno)
                                   ├── lookup-barcode   → Open Food Facts
                                   └── suggest-cocktails → Claude
```

Two ideas carry most of the design:

**A canonical ingredient vocabulary.** `ingredients` is a small table with a
parent chain — `london-dry-gin` → `gin`. A bottle points at one, and so does
every recipe line. That single join is what lets a recipe asking for *gin* match
your Tanqueray, and it is what makes "what can I make right now" answerable at
all. Owning a specific gin satisfies a call for generic gin; owning generic gin
does not satisfy a call for Old Tom.

**One recipe format.** An AI suggestion you save and a recipe you type by hand
produce identical rows, differing only in `source`. The AI path is constrained
to that schema by structured outputs, so there is nothing to reconcile later.

Liquid amounts are stored normalised in millilitres, with the unit as authored
kept alongside — a dash stays a dash. The ml ↔ oz switch in settings is purely a
display concern.

---

## Setup

The Supabase project (`qhmovlrsmwlkfgypwglr`, eu-west-2) is already provisioned:
migrations applied, 177 ingredients seeded, row-level security on every table,
and both edge functions deployed. Three things remain.

### 1. The Anthropic key

The only outstanding piece, and the one the Ask tab needs:

```sh
supabase link --project-ref qhmovlrsmwlkfgypwglr
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Or set it under **Edge Functions → Secrets** in the dashboard. It lives there and
only there — never in the app bundle. Until it's set, `suggest-cocktails` returns
"the suggestion service is not configured"; everything else works.

### 2. Email sign-in

Sign-in uses a six-digit code rather than a magic link, so there is no deep-link
configuration to get wrong. Supabase sends a link by default — in **Authentication
→ Email templates → Magic Link**, make sure the template includes the token:

```
Your Flanagan code is {{ .Token }}
```

### 3. Run it

`.env` is already filled in with the project URL and publishable key (both safe
in the bundle — the key grants only what row-level security allows). If you're
setting up a fresh clone, `cp .env.example .env` and copy them from **Project
settings → API**.

```sh
npm install
npx expo start
```

Barcode scanning needs real camera hardware, so use a device rather than a
simulator.

### Re-applying from scratch

Everything is reproducible from the repo:

```sh
supabase db push                      # all migrations, in order
supabase functions deploy lookup-barcode
supabase functions deploy suggest-cocktails
```

---

## Notes

- **`suggest-cocktails` verifies the model.** Claude is given the exact list of
  ingredient slugs you have and told to use nothing else, and the response is
  then re-checked against that list server-side. Recipes needing something you
  don't have are dropped and counted, not quietly served. A drink you can't pour
  is worse than one fewer suggestion.
- **The barcode catalogue is shared.** Resolving a barcode once — from Open Food
  Facts or by filling the form in yourself — writes a `products` row, so the next
  scan of that bottle is instant. Open Food Facts coverage of spirits is patchy;
  the personal catalogue is what makes this pleasant over time.
- **Free-text ingredients don't count.** A recipe line with no canonical
  ingredient (your own cordial, say) is kept and labelled, but never counted as
  available. Under-reporting beats claiming something the app cannot verify.

## Commands

| | |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` over the app (edge functions are Deno, checked separately) |
| `supabase db push` | Apply migrations |
| `supabase functions deploy <name>` | Deploy an edge function |
