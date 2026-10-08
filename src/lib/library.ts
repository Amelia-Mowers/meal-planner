import type { Combo, Component, Food, Format, Library, LibraryFile, RecipeDoc, Role, Source } from './types'
import { fromQV, type Qty } from './units'

export const MP_CONTEXT = {
  '@vocab': 'https://schema.org/',
  mp: 'https://amelia-mowers.github.io/meal-planner/ns#',
}

const arr = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])

/** ISO-8601 duration (PT1H20M) → minutes. */
export function isoMinutes(d?: string): number {
  if (!d) return 0
  const m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(d)
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : 0
}

export function minutesIso(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `PT${h ? `${h}H` : ''}${m || !h ? `${m}M` : ''}`
}

function basedOnText(v: RecipeDoc['isBasedOn']): string | undefined {
  if (!v) return undefined
  if (typeof v === 'string') return v
  return v.name ?? v.url
}

export function parseComponent(doc: RecipeDoc, source: Source): Component {
  const portion = fromQV(doc['mp:portion']) ?? { value: 1, unit: 'whole' }
  const range = doc['mp:portionRange']
  return {
    id: doc['@id'],
    name: doc.name,
    shortName: doc.alternateName ?? doc.name,
    description: doc.description ?? '',
    role: doc.recipeCategory as Role,
    cuisines: arr(doc.recipeCuisine).map((c) => c.toLowerCase()),
    formats: arr(doc['mp:formats']).length ? arr(doc['mp:formats']) : ['bowl', 'wrap'],
    portion,
    portionRange: range ? [range.minValue, range.maxValue] : undefined,
    yield: fromQV(doc.recipeYield) ?? portion,
    supplies: arr(doc.supply).map((s) => ({
      foodId: s.identifier,
      qty: fromQV(s.requiredQuantity) ?? { value: 1, unit: 'whole' },
      description: s.description,
    })),
    steps: arr(doc.recipeInstructions).map((s) => (typeof s === 'string' ? s : s.text)),
    tools: arr(doc.tool).map((t) => (typeof t === 'string' ? t : t.name)),
    prepMin: isoMinutes(doc.prepTime),
    cookMin: isoMinutes(doc.cookTime),
    fridgeDays: doc['mp:fridgeDays'] ?? null,
    freezable: !!doc['mp:freezable'],
    serve: doc['mp:serve'] ?? 'either',
    keywords: arr(doc.keywords).flatMap((k) => k.split(',').map((s) => s.trim())).filter(Boolean),
    secondary: !!doc['mp:secondary'],
    batchGroup: doc['mp:batchGroup'],
    meal: doc['mp:meal'],
    tested: !!doc['mp:tested'],
    needsReview: !!doc['mp:needsReview'],
    license: doc.license,
    author: doc.author?.name,
    isBasedOn: basedOnText(doc.isBasedOn),
    source,
    doc,
  }
}

export function parseCombo(doc: RecipeDoc, source: Source): Combo {
  return {
    id: doc['@id'],
    name: doc.name,
    description: doc.description ?? '',
    meal: doc['mp:meal'] ?? 'main',
    format: (doc['mp:format'] ?? 'bowl') as Format,
    steps: arr(doc.recipeInstructions).map((st) => (typeof st === 'string' ? st : st.text)),
    assembleAtPrep: !!doc['mp:assembleAtPrep'],
    prepMin: isoMinutes(doc.prepTime),
    cuisine: arr(doc.recipeCuisine)[0] ?? 'neutral',
    parts: arr(doc.supply).map((s) => ({
      componentId: s.identifier,
      qty: fromQV(s.requiredQuantity) ?? undefined,
    })),
    curated: true,
    tested: !!doc['mp:tested'],
    source,
    doc,
  }
}

/** FNV-1a 32-bit, hex. Used to fingerprint library content for QR handoff. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function buildLibrary(
  foods: Food[],
  bundled: LibraryFile,
  privateDocs: RecipeDoc[] = [],
  privateFoods: Food[] = [],
): Library {
  const lib: Library = {
    version: bundled['mp:version'] ?? fnv1a(JSON.stringify(bundled['@graph'])),
    foods: new Map(),
    components: new Map(),
    combos: new Map(),
  }
  for (const f of [...foods, ...(bundled.foods ?? []), ...privateFoods]) lib.foods.set(f.id, f)
  const add = (doc: RecipeDoc, source: Source) => {
    if (doc['@type'] !== 'Recipe' || !doc['@id']) return
    if (doc.recipeCategory === 'combo') lib.combos.set(doc['@id'], parseCombo(doc, source))
    else lib.components.set(doc['@id'], parseComponent(doc, source))
  }
  for (const d of bundled['@graph']) add(d, 'bundled')
  for (const d of privateDocs) add(d, 'private')
  return lib
}

/** Default quantity of a component inside a combo. */
export function partQty(lib: Library, componentId: string, override?: Qty): Qty | null {
  if (override) return override
  return lib.components.get(componentId)?.portion ?? null
}

export const slug = (id: string) => id.replace(/^[a-z]+\//, '')
