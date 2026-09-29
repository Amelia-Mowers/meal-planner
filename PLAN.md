# Bowl & Wrap Meal Prep App — Project Plan

A personal, static-hosted web app for component-based meal prep. You pick a small weekly "prep set" of proteins, carbs, veg, and sauces. The app then:

- suggests bowl and wrap combinations from that set
- shows nutrition for each combination against a target
- produces a merged shopping list and a batch-prep plan

There is no backend. Data lives in the browser, and devices hand off via QR (Quick Response) code.

---

## 1. Goals

- **Component-first**: the unit of data is a component (e.g. "shredded chicken", "lemon-tahini sauce"), not a full recipe. Meals are combinations of components.
- **Ultra low effort**: mostly assembly, with some batch cooking and sauce-mixing.
- **Nutrition-aware**: each combo shows calories and protein and is checked against a configurable target. The default target is **~600 kcal and ≥40 g protein per meal**.
- **Standard format**: recipes are stored as schema.org `Recipe` JSON-LD (JSON for Linked Data), so the data stays portable (e.g. importable into Tandoor or Mealie).
- **Private by default**: personal cookbook conversions never get deployed.

## 2. Non-goals (for v1)

- No server, accounts, or real-time sync
- No calorie or food-intake logging (this is a planner, not a tracker)
- No recipe web scraping

## 3. Architecture

- **Hosting**: static site (GitHub Pages or Cloudflare Pages).
- **App type**: PWA (Progressive Web App), so it works offline in the grocery store.
- **Suggested stack**: Vite + TypeScript + a lightweight UI framework (Svelte or Preact). Dexie is a good wrapper for IndexedDB. Final stack choices are open.
- **Storage**: IndexedDB, the browser's built-in database. Do **not** use localStorage, which has a ~5 MB cap and is synchronous.
  - Call `navigator.storage.persist()` on first run so the browser doesn't evict data.
- **Two data layers**:
  1. **Bundled library** (shipped with the site): openly licensed components and combos only. It is identical on every device, so IDs resolve anywhere.
  2. **Private overlay** (IndexedDB only): recipes converted from personal cookbooks. Imported from a local JSON file and never committed to the deployed bundle.
- **Export/import**: full data export and import as a JSON file, for backup and manual sync.

## 4. Data model

### 4.1 Components — schema.org `Recipe`

Prefer standard schema.org fields. Anything with no standard home goes under a namespaced extension prefix (e.g. `mp:`) declared in `@context`.

| Concept | Field |
|---|---|
| Stable ID | `@id` (slug, e.g. `comp/chicken-shredded`) — never array indices |
| Role | `recipeCategory`: `protein` \| `base` \| `veg` \| `sauce` \| `topper` |
| Flavor profile | `recipeCuisine`: `mexican` \| `mediterranean` \| `east-asian` \| `neutral` (multi-valued) |
| Format fit | `mp:formats`: `["bowl", "wrap"]` |
| Default portion | `mp:portion`: `{ value, unit }`, e.g. 150 g cooked protein |
| Display ingredients | `recipeIngredient`: plain strings (for interop) |
| Structured ingredients | `supply`: array of `HowToSupply` (see 4.2) |
| Equipment (optional) | `tool`: `HowToTool` |
| Steps | `recipeInstructions`: `HowToStep[]` |
| Provenance | `author`, `license`, `isBasedOn` |
| Review state | `mp:tested` (bool), `mp:needsReview` (bool) |
| Storage | `mp:fridgeDays`, `mp:freezable` |
| Serving temperature | `mp:serve`: `hot` \| `cold` \| `either` |

**Why `supply`**: schema.org's `Recipe` is a subtype of `HowTo`, and `recipeIngredient` is officially a sub-property of `supply`. `supply` accepts structured `HowToSupply` objects, so structured ingredients stay within the standard vocabulary. Other importers ignore `supply` and fall back to `recipeIngredient`.

### 4.2 Structured ingredient — `HowToSupply`

```json
{
  "@type": "HowToSupply",
  "name": "chicken breast",
  "description": "cooked, shredded",
  "identifier": "food/chicken-breast",
  "requiredQuantity": { "@type": "QuantitativeValue", "value": 500, "unitCode": "GRM" }
}
```

- `identifier` points to a canonical food in `foods.json` (4.4).
- For units, use `unitCode` (UN/CEFACT codes, e.g. `GRM` for gram, `LTR` for litre) where possible, and `unitText` otherwise (`whole`, `cup`, `tbsp`, `can`).

### 4.3 Combos

A combo is also a `Recipe` (`recipeCategory: "combo"`). Its `supply` entries reference component `@id`s, with an optional portion override:

```json
{
  "@type": "Recipe",
  "@id": "combo/chipotle-chicken-bowl",
  "name": "Chipotle Chicken Bowl",
  "recipeCategory": "combo",
  "recipeCuisine": "mexican",
  "mp:format": "bowl",
  "supply": [
    { "@type": "HowToSupply", "identifier": "comp/chicken-breast-sheetpan" },
    { "@type": "HowToSupply", "identifier": "comp/rice-white",
      "requiredQuantity": { "@type": "QuantitativeValue", "value": 0.75, "unitText": "cup" } },
    { "@type": "HowToSupply", "identifier": "comp/black-beans" },
    { "@type": "HowToSupply", "identifier": "comp/broccoli-slaw" },
    { "@type": "HowToSupply", "identifier": "comp/pickled-red-onion" },
    { "@type": "HowToSupply", "identifier": "comp/yogurt-chipotle-crema" }
  ]
}
```

### 4.4 Canonical foods — `foods.json`

This is a single table that every ingredient resolves to. It drives both nutrition and shopping-list merging.

```json
{
  "id": "food/chicken-breast",
  "name": "chicken breast",
  "aliases": ["chicken breasts", "boneless skinless chicken breast"],
  "fdcId": 171477,
  "per100g": { "kcal": 165, "protein": 31, "fat": 3.6, "carbs": 0, "fiber": 0 },
  "gramsPerUnit": { "whole": 174 },
  "densityGPerMl": null,
  "aisle": "meat",
  "buyUnit": { "value": 1, "unitText": "lb" }
}
```

- Nutrition comes from USDA FDC (FoodData Central): the Foundation and SR Legacy datasets. Preprocess them offline into this compact form.
- Never trust LLM-stated nutrition. Always compute it from these values.

## 5. Core features

### 5.1 Weekly flow

1. **Pick a prep set**: e.g. 2 proteins, 1–2 bases, 3 veg, 2–3 sauces. Offer suggested starter sets.
2. **See combos**: curated combos that the set satisfies, plus generated suggestions.
3. **Plan the week**: assign combos to meal slots (optional; the app should also work fine as "just give me combos").
4. **Outputs**:
   - a shopping list for the prep set
   - a batch-prep plan (what to cook, in what order, and how long it keeps)
   - per-combo nutrition

### 5.2 Combo generation

- A valid generated combo has one base, one protein, one or more veg, one sauce, and an optional topper.
- **Flavor compatibility**: components must share a `recipeCuisine` with the sauce or be `neutral`. The sauce sets the combo's profile.
- **Format fit**: every component must support the chosen format (`bowl` or `wrap`). Wrap format swaps the base for a tortilla or pita.
- **Ranking**: curated combos first, then generated ones ranked by closeness to the nutrition target.

### 5.3 Nutrition

- Per-combo totals equal the sum over components of (component nutrition per portion). Component nutrition is the sum of its supplies converted to grams × `per100g`.
- Show a **"hits target"** badge: within about ±10% of the kcal target and at or above the protein target. Targets are user-configurable.
- **Portion slider**: let the carb portion flex (e.g. ½–1 cup) to hit the target. This is the main lever.

### 5.4 Shopping list

- Aggregate by canonical food ID.
- Unit merging:
  - Same dimension (mass↔mass, volume↔volume): convert and sum.
  - Volume↔mass: only if `densityGPerMl` is known.
  - Otherwise, list the amounts separately under the same food.
- Round up to buy units (e.g. "1 lb", "1 bag", "1 can").
- Group items by `aisle`.
- Let the user check off pantry items they already have.

### 5.5 QR handoff (laptop → phone)

- Payload goes in the **URL fragment** (`/#p=...`). The fragment is never sent to the host server.
- Encoding: JSON → deflate (browser `CompressionStream`) → base45. Base45 fits QR alphanumeric mode about 30% more efficiently than base64.
- Payload contents:
  - `v`: library version
  - `m`: menu as `[comboId, servings]` references
  - `s`: the **precomputed shopping list** (fallback, so the list works even if the phone's library is stale or lacks private recipes)
- Target payload size: under ~800 bytes for reliable scanning off a screen.
- The phone warns if its library version differs from `v`.

## 6. Bundled library

### 6.1 Licensing

- Bundle only CC0 (Creative Commons public-domain dedication), public-domain, CC BY (Attribution), or CC BY-SA (Attribution-ShareAlike) content. Record `author`, `license`, and `isBasedOn` on each item.
- **LLM-generated components**: license as **CC0**. Purely AI-generated text is likely not copyrightable in the US, so CC0 is the accurate choice.
- **USDA MyPlate Kitchen** recipes (US Department of Agriculture) are largely public domain. Verify each one, since some are adapted from third parties.

### 6.2 Food safety

Hard-code these as constants rather than taking LLM output:

- poultry: 165°F / 74°C
- ground meat: 160°F / 71°C
- fridge life: generally 3–4 days for cooked proteins

### 6.3 Starter library (v1 scope)

Target about 6 proteins, 5 bases, 10+ veg, and 8 sauces, which yields hundreds of valid combos. It is tailored to these preferences:

- **Cuisines**: Mexican, Mediterranean, East Asian
- **Heat**: medium
- **Veg style**: raw and crunchy, or pickled and tangy, plus steamed bagged broccoli and frozen spinach
- **Exclude entirely**: mushrooms, olives, capers, zucchini
- **Effort**: mostly assembly (rotisserie chicken, pouches, bagged veg); batch cooking and sauce-mixing are fine

**Proteins**
- Rotisserie chicken, shredded, skin off
- Sheet-pan chicken breast or thighs
- 93%-lean ground turkey, one batch split three ways: taco, gochujang, kofta
  - Frozen spinach can be mixed in
- Hard-boiled or jammy eggs
- Baked tofu
- Black beans and chickpeas (secondary proteins)

**Bases**
- Rice
- Quinoa
- Couscous
- Tortillas (prefer high-protein/high-fiber for the calorie budget)
- Pita
- Soba or rice noodles
- Roast potatoes

**Veg**
- Steamed bagged broccoli
- Frozen spinach (stirred into proteins, rice, or sauces)
- Broccoli slaw
- Cabbage slaw
- Cucumber
- Bell pepper
- Shredded carrot
- Radish
- Cherry tomatoes
- Romaine
- Edamame
- Frozen corn
- Pickled: pickled red onion, quick-pickled cucumber, kimchi, pickled jalapeños, giardiniera, pepperoncini

**Sauces**
- Default to **Greek-yogurt bases**, which are low-calorie and add protein:
  - tzatziki
  - yogurt chipotle crema
  - yogurt-lime crema
- Also:
  - salsa verde
  - lemon-tahini
  - lemon-oregano vinaigrette
  - peanut-lime
  - gochujang-honey
  - ginger-scallion
  - sesame-soy
  - honey mustard
- Calorie-dense sauces (peanut, tahini, mayo-based, honey mustard) get a smaller default portion.

**Toppers**
- Feta
- Cotija
- Sesame seeds
- Pepitas
- Crispy fried onions
- Furikake
- Cilantro

**Seed combos**
- Chipotle chicken bowl
- Turkey taco wrap
- Chicken pita with tzatziki
- Chickpea grain bowl with lemon-tahini
- Gochujang turkey bowl with kimchi and egg
- Peanut soba with tofu and broccoli slaw

### 6.4 Portion template (defaults)

| Role | Default portion | Approx. kcal | Approx. protein |
|---|---|---|---|
| Protein | 150 g cooked | 250–320 | 38–47 g |
| Base | ¾ cup cooked / 1 pita | 150–200 | 3–6 g |
| Veg | 1.5–2 cups | 50–80 | 2–5 g |
| Sauce | 2–3 tbsp | 40–150 | 0–5 g |
| Topper | ~1 oz / 1 tbsp | 0–75 | 0–4 g |

## 7. Cookbook conversion pipeline (separate from the app)

This is a local script, run offline. It is not part of the deployed site.

1. **Capture**: photos or scans of cookbook pages.
2. **Extract**: a vision LLM reads the pages and outputs schema.org `Recipe` JSON with **both** `recipeIngredient` strings and a structured `supply`.
   - Split each ingredient into amount / unit / food / note. For example, "1 yellow onion, finely diced" becomes food `onion`, note `yellow, finely diced`.
3. **Canonicalize**: resolve each food to `foods.json`. Pass the existing canonical list in the prompt and instruct the model to reuse names. Unmatched foods get queued for review.
4. **Flag**: set `mp:needsReview` for vague quantities ("to taste", "1 can"), low-confidence extractions, and unit ambiguity.
5. **Decompose (optional)**: where a cookbook recipe is really a protein plus a sauce, split it into components.
6. **Output**: `private-library.json`, imported into the app's private overlay via file picker. **Never commit this file to the repo.** Add it to `.gitignore`.

The same pipeline, minus capture, generates the CC0 starter library from prompts.

## 8. Milestones

1. **Data foundation**
   - `foods.json` with FDC nutrition for starter foods
   - JSON schema and validator for components and combos
2. **Starter library**
   - Generate and validate the component and combo set from §6.3
3. **Core app**
   - Browse components and combos
   - Nutrition display with target badge
   - IndexedDB persistence
4. **Prep-set flow**
   - Pick a set → valid combos → shopping list with unit merging → batch-prep plan
5. **PWA + QR handoff**
   - Offline support
   - Fragment payload and QR rendering on laptop; scan-to-open on phone
6. **Private overlay**
   - JSON import/export
   - Cookbook conversion script (§7)
7. **Polish**
   - Portion slider
   - Pantry check-off
   - `tested` flag toggle and filter

## 9. Open questions

- Should meal slots (a weekly calendar) exist, or is "combos from my prep set" enough?
- Should the batch-prep plan include ordering/timing (oven vs. rice cooker in parallel) or just a checklist?
- Should targets be per-meal only, or also daily?
