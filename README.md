# Flanagan

A personal mixology app: your bottles, and what they can make tonight.

- **Home** — where the app opens: a greeting, the Ask entry point with one-tap
  mood prompts, tonight's makeable picks, a bar-at-a-glance ledger, bottles
  running low, and shortcuts. Everything deep-links into the right
  pre-filtered view. Scanning lives here and in the Bar header — it is an
  inventory chore, not a tab.
- **Bar** — your inventory, added by scanning barcodes, photographing a whole
  shelf, or by hand, plus the everyday staples (limes, syrup, soda) that decide
  whether a drink is actually possible.
- **Ask** — describe what you feel like ("a gin-based dry cocktail with floral
  notes") and get cocktails you can pour from what is in stock.
- **Recipes** — suggestions you save and recipes you write yourself — typed
  in, or scanned off a book page, a menu or a screenshot — in one shared
  format, filterable by what's makeable right now.

Expo (iOS + Android) · Supabase (Postgres, auth, edge functions) · OpenAI.

---

## How it fits together

```
Expo app
  ├── supabase-js ─────────────►  Postgres (row-level security, per user)
  │                               Auth (email six-digit code)
  │                               Storage (`recipe-photos`, per-user folders)
  └── functions.invoke() ──────►  Edge functions (Deno)
                                   ├── lookup-barcode    → Open Food Facts
                                   ├── classify-bottle   → OpenAI
                                   ├── identify-bottles  → OpenAI (vision)
                                   ├── read-recipe       → OpenAI (vision)
                                   └── suggest-cocktails → OpenAI
                                        (prompt + model from `ai_prompts`)
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

### 1. The OpenAI key

The only outstanding piece, and the one the Ask tab needs:

```sh
supabase link --project-ref qhmovlrsmwlkfgypwglr
supabase secrets set OPENAI_API_KEY=sk-...
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
simulator. The shelf-photo library picker (`expo-image-picker`) is a native
module: any build made before it was added needs rebuilding (`eas build` or
`npx expo run:ios`) before that button works — an OTA update alone won't add it.

> **This project is pinned to Expo SDK 54, and the pin is not a preference.**
>
> Expo Go supports exactly one SDK version — the one its binary was built
> against — so the project has to match the installed client in *both*
> directions. A project one SDK behind the client is refused just as flatly as
> one ahead, and the error is the same unhelpful *"requires a newer version of
> Expo Go"* either way. The device this was set up against reports **Supported
> SDK 54**, so 54 is what the project targets, three releases behind `latest`.
>
> **Read the target off the device, don't infer it.** In Expo Go: **Settings →
> App Info → Supported SDK**. That number is the only thing that decides whether
> the project opens, and it is not always the newest SDK even on a freshly
> installed client — the App Store serves an older build when the newest one
> needs a newer iOS than the phone runs.
>
> If Expo Go ever updates past 54, this project stops opening until the pin
> moves with it. Move it with `npx expo install expo@^<major> --fix`, which
> shifts every Expo package as a set; `npx expo install --check` reports whether
> the current dependency set matches the pin. Do not bump `expo` on its own.
>
> Note SDK 54 predates Expo's unified versioning, so its packages have
> independent version lines (`expo-camera@17`, `expo-font@14`, `expo-image@3`)
> rather than matching the SDK number. `expo-font` and `react-native-screens` are
> pinned explicitly because `@expo/vector-icons` and `expo-router` declare them
> as open-ended peers (`>=14.0.4`, `*`), which npm otherwise satisfies with the
> newest published version — quietly dropping a current-SDK native module into
> the tree.
>
> The permanent way out of all of this is a development build
> (`npx expo run:ios` on a cabled iPhone — needs a Mac with Xcode, but no Apple
> Developer membership), which ignores Expo Go's SDK entirely.

### Re-applying from scratch

Everything is reproducible from the repo:

```sh
supabase db push                      # all migrations, in order
supabase functions deploy lookup-barcode
supabase functions deploy classify-bottle
supabase functions deploy identify-bottles
supabase functions deploy read-recipe
supabase functions deploy suggest-cocktails
```

---

## Notes

- **`suggest-cocktails` verifies the model.** OpenAI is given the exact list of
  ingredient slugs you have and told to use nothing else, and the response is
  then re-checked against that list server-side. Recipes needing something you
  don't have are dropped and counted, not quietly served. A drink you can't pour
  is worse than one fewer suggestion.
- **The prompt is data, not code.** The bartender's system prompt, the model, the
  token cap and the reasoning effort all live in `public.ai_prompts`, keyed by
  call site. Re-tuning is an `UPDATE` with no redeploy — insert a new `version`
  and flip `is_active` to keep the old wording around to compare against. The
  `{{INVENTORY}}` placeholder in the prompt is where the list of what you own
  gets substituted; drop it and the function appends the list anyway rather than
  ask a model to guess. The table is deliberately unreadable to the app: only the
  edge function's service-role client sees it.
- **A shelf photo is a prefill, not an import.** The scanner's *Shelf* mode
  sends one photo (taken there, or picked from the library) to
  `identify-bottles`, which lists every bottle it can read a label for and pins
  each to an ingredient slug under the same rules as `classify-bottle`. What
  comes back is a review list: doubtful readings and bottles already on the
  shelf start unticked, "counts as" is a tap away from being changed, and only
  the ticked rows are inserted — in one batch, when you say so. The photo is not
  stored anywhere.
- **Recipe photos are the one thing in Storage.** A saved recipe can carry a
  picture of the finished drink, taken there or picked from the library. Objects
  live in the public `recipe-photos` bucket at `<user>/<recipe>/<stamp>.jpg`;
  policies lock writes to the owner's folder and the recipe row keeps the public
  URL (`recipes.image_url`). Replacing or removing a photo, or deleting the
  recipe, removes the old object; a failed cleanup is swallowed rather than
  block the action asked for.
- **A scanned recipe is a prefill, not an import.** *Write a recipe* opens
  with a *Scan a recipe* card: photograph a page (or pick a screenshot) and
  `read-recipe` reads it — title, lines with quantities and units, method,
  ice, glass, garnish, steps, attribution — straight into the editor's fields,
  pinning each ingredient line to a vocabulary slug under the same rules as
  the bottle classifiers, and leaving anything it cannot place as free text in
  the printed wording. Units are kept as printed (an ounce recipe stays in
  ounces), nothing is composed that is not on the page, and a page with
  several recipes offers a choice. The editor is the review step: nothing is
  saved until the form is. The photo is not stored anywhere.
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
