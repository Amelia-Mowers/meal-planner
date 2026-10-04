# third-party/ — private, never committed

Everything in this folder except this README is gitignored. Put copyrighted or personal
material here: cookbook page photos/scans, drafts, and the converted output.

```
third-party/
  scans/<book>/page-012.jpg     # capture (§7 step 1)
  private-library.json          # converted output — import in the app
  unmatched-foods.md            # foods that need adding to foods.json
```

## Converting a recipe (manually, in Claude Code)

Open Claude Code in this repo and ask it to convert pages, e.g.:

> Convert `third-party/scans/book/page-012.jpg` and `page-013.jpg` (one recipe, from
> "Book Title" by Author) into components and merge them into
> `third-party/private-library.json`, following `third-party/README.md`.

Rules for the conversion (PLAN.md §7):

1. **Format**: a JSON-LD file `{ "@context", "@graph": [Recipe…], "foods": [] }`, where each
   Recipe matches `schema/recipe.schema.json` — same shape as `src/data/library.jsonld`.
   IDs are `comp/<slug>` (components) or `combo/<slug>`.
2. **Both ingredient forms**: `recipeIngredient` (lines as printed) *and* structured `supply`
   (`HowToSupply` with `identifier`, `requiredQuantity`, `description` for notes).
   Split "1 yellow onion, finely diced" → amount 1, unit `whole`, food onion, note "yellow, finely diced".
3. **Canonicalize**: every `identifier` must be an ID from `src/data/foods.json`. If nothing
   fits, add an entry to the file's `foods` array with an `fdcId` and `per100g` copied from USDA FoodData Central
   (or add it to `data/foods.source.json` and run `npm run build:foods` if it's generic
   enough for the public library) — **never take nutrition from the model**.
4. **Flag**: set `"mp:needsReview": true` and list reasons in `"mp:reviewNotes"` for vague
   quantities ("to taste", "1 can"), low-confidence reads, or unit ambiguity.
5. **Decompose** where a recipe is really protein + sauce: emit two components.
6. **Provenance**: set `isBasedOn` to the book (title, author, page).
7. **Exclusions**: no mushrooms, olives, capers or zucchini.
8. **One canonical version**: no optional ingredients, no "or" alternatives, no "to taste".
   Every ingredient a step mentions must be in `supply` with an amount, otherwise it never
   reaches the shopping list or nutrition. Pick one method and one amount. (The validator
   flags hedges like "optional", "swap", "instead", "(or …".)
9. **Reuse the standard bases.** A recipe's protein should be a flavor of an existing batch,
   not a new cooking method: ground meat → a new `ground-turkey` flavor (93% turkey, browned
   with the batch, then seasoned); chicken breast → a new `sheet-pan-chicken` flavor (roasted
   with the batch at 425°F). Give the component `"mp:batchGroup"` and make its first step point
   at the batch, like `comp/turkey-taco` or `comp/chicken-sheetpan-herb`. Reuse existing bases,
   veg and sauces (e.g. `comp/rice-white`, `comp/broccoli-steamed`) instead of near-duplicates.

Then check and import:

```sh
npm run validate -- third-party/private-library.json
```

In the app: **Settings → Private recipes → Import private library**. Private recipes live only
in that browser's IndexedDB; they are never deployed.
