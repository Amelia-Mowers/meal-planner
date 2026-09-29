# Bowl & Wrap — meal prep planner

**▶ Live app: https://amelia-mowers.github.io/meal-planner/**

A static, offline-first web app for component-based meal prep. Plan a period (a week, half a week,
or any number of days, for however many people), pick bowl and wrap combos for it, and it:

- derives the **prep set** — which components to batch-cook and how much — with adjustable quantities
- suggests combos that reuse what you're already prepping, or build your own
- shows calories and protein per combo against a target (default 600 kcal, ≥40 g protein), with a
  portion slider on the carb to hit it
- builds a merged, aisle-grouped shopping list rounded up to store packages
- lays out a batch-prep plan in parallel lanes (oven, rice cooker, stovetop, counter)
- syncs the whole period between devices with QR codes — plan plus shopping/prep checkmarks, merged
  both ways (newest plan wins; each checkmark keeps the latest change). Scan with the built-in
  scanner (camera, photo, or pasted link) so iOS stays in the installed app. Nothing is uploaded:
  the plan lives in the URL fragment

Start a new period when one ends — blank, repeating the current plan, or repeating a past one.

No backend and no accounts. Data lives in IndexedDB on each device. See [PLAN.md](PLAN.md) for the design.

## Development

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run check        # svelte-check + script type check
npm run validate     # schema, references, units, flavors, licensing, exclusions
npm run build        # production build to dist/ (PWA)
```

Stack: Vite, Svelte 5, TypeScript, Dexie (IndexedDB), vite-plugin-pwa, qrcode.

## Data

| File | What |
|---|---|
| `data/foods.source.json` | Hand-maintained canonical foods: names, aisles, buy units, FDC IDs |
| `src/data/foods.json` | Generated: adds USDA nutrition (`npm run build:foods`, downloads SR Legacy into `.cache/`) |
| `data/library.source.ts` | Authoring source for the CC0 starter library |
| `src/data/library.jsonld` | Generated schema.org `Recipe` JSON-LD (`npm run build:library`) |
| `schema/*.schema.json` | JSON Schemas for recipes and foods |

Nutrition always comes from USDA FoodData Central. The few foods without a USDA match use
typical label values, are flagged `needsReview`, and show as approximate (≈) in the app.

## Private recipes

Cookbook conversions go in `third-party/`, which is gitignored (except its README). They're done
by hand in Claude Code — see [third-party/README.md](third-party/README.md). Import the result in
the app under **Settings → Private recipes**. It stays in that browser and is never deployed.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: validate, type check, test, build with
`BASE_PATH=/<repo>/`, and publish to GitHub Pages.

## Licenses

- Code: MIT
- Starter library: AI-generated, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Nutrition data: USDA FoodData Central, public domain
- Icons: [Lucide](https://lucide.dev) (ISC)
