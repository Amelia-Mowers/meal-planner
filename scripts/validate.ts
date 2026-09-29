/**
 * Validates foods + library (and optionally a private library file):
 *   npm run validate                       # bundled data
 *   npm run validate -- private-library.json
 *
 * Checks JSON Schema, referential integrity, unit convertibility, format/flavor rules,
 * licensing, and excluded ingredients; prints computed nutrition for every combo.
 */
import Ajv2020 from 'ajv/dist/2020.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sharedProfile } from '../src/lib/combos'
import { buildLibrary } from '../src/lib/library'
import { batchNutrition, partsNutrition, targetStatus } from '../src/lib/nutrition'
import { AISLES } from '../src/lib/shopping'
import type { Food, LibraryFile, RecipeDoc } from '../src/lib/types'
import { fromQV, ratio, toGrams } from '../src/lib/units'

const ROOT = new URL('..', import.meta.url).pathname
const read = (p: string) => JSON.parse(readFileSync(p.startsWith('/') ? p : join(ROOT, p), 'utf8'))

const ALLOWED_LICENSES = [
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/publicdomain/mark/1.0/',
  'https://creativecommons.org/licenses/by/4.0/',
  'https://creativecommons.org/licenses/by-sa/4.0/',
]
/** Never allowed anywhere in the library. "olive oil" is fine; olives are not. */
const EXCLUDED = [/mushroom/i, /\bolives?\b(?! oil)/i, /\bcapers?\b/i, /zucchini|courgette/i]

const errors: string[] = []
const warnings: string[] = []
const err = (m: string) => errors.push(m)

const ajv = new Ajv2020({ allErrors: true, strict: false })
const recipeSchema = read('schema/recipe.schema.json')
const foodSchema = read('schema/food.schema.json')
ajv.addSchema(recipeSchema)
const validateRecipe = ajv.compile(recipeSchema)
const validateFood = ajv.compile(foodSchema)

const foods: Food[] = read('src/data/foods.json').foods
const bundled: LibraryFile = read('src/data/library.jsonld')
const privatePath = process.argv[2]
const priv: LibraryFile | null = privatePath ? read(privatePath) : null

// ── Foods ──
const foodIds = new Set<string>()
for (const f of [...foods, ...(priv?.foods ?? [])]) {
  if (!validateFood(f)) err(`${f.id}: ${ajv.errorsText(validateFood.errors)}`)
  if (foodIds.has(f.id)) err(`${f.id}: duplicate food id`)
  foodIds.add(f.id)
  if (!AISLES[f.aisle]) err(`${f.id}: unknown aisle "${f.aisle}"`)
  const buy = fromQV(f.buyUnit)
  if (buy && toGrams(buy, f) == null) err(`${f.id}: buyUnit ${buy.value} ${buy.unit} not convertible to grams`)
  for (const re of EXCLUDED) if (re.test([f.name, ...(f.aliases ?? [])].join(' '))) err(`${f.id}: excluded ingredient`)
  if (f.needsReview) warnings.push(`${f.id}: nutrition from label values (needs review)`)
}

// ── Recipes ──
const docs: RecipeDoc[] = [...bundled['@graph'], ...(priv?.['@graph'] ?? [])]
const ids = new Set<string>()
for (const d of docs) {
  if (!validateRecipe(d)) err(`${d['@id']}: ${ajv.errorsText(validateRecipe.errors)}`)
  if (ids.has(d['@id'])) err(`${d['@id']}: duplicate id`)
  ids.add(d['@id'])
  const isPrivate = !bundled['@graph'].includes(d)
  if (!isPrivate) {
    if (!d.license || !ALLOWED_LICENSES.includes(d.license)) err(`${d['@id']}: license must be one of CC0/PD/CC BY/CC BY-SA`)
    if (!d.author?.name) err(`${d['@id']}: missing author`)
  }
  const text = [d.name, d.description, ...(d.recipeIngredient ?? [])].join(' ')
  for (const re of EXCLUDED) if (re.test(text)) err(`${d['@id']}: contains excluded ingredient (${re})`)
}

const lib = buildLibrary(foods, bundled, priv?.['@graph'] ?? [], priv?.foods ?? [])

for (const c of lib.components.values()) {
  for (const s of c.supplies) {
    const food = lib.foods.get(s.foodId)
    if (!food) err(`${c.id}: unknown food ${s.foodId}`)
    else if (toGrams(s.qty, food) == null)
      err(`${c.id}: ${s.qty.value} ${s.qty.unit} of ${s.foodId} not convertible to grams (add gramsPerUnit or densityGPerMl)`)
  }
  if (ratio(c.portion, c.yield) == null) err(`${c.id}: portion unit "${c.portion.unit}" incompatible with yield "${c.yield.unit}"`)
  if (c.portionRange) {
    const [lo, hi] = c.portionRange
    if (!(lo <= c.portion.value && c.portion.value <= hi)) err(`${c.id}: portion outside portionRange`)
  }
  const n = batchNutrition(lib, c)
  for (const i of n.issues) err(`${c.id}: ${i}`)
}

const roles = ['base', 'protein', 'veg', 'sauce']
for (const combo of lib.combos.values()) {
  const cs = combo.parts.map((p) => lib.components.get(p.componentId))
  combo.parts.forEach((p, i) => !cs[i] && err(`${combo.id}: unknown component ${p.componentId}`))
  const ok = cs.filter((c) => !!c)
  for (const r of roles) if (!ok.some((c) => c.role === r)) err(`${combo.id}: no ${r}`)
  if (ok.filter((c) => c.role === 'base').length > 1) err(`${combo.id}: more than one base`)
  for (const c of ok) if (!c.formats.includes(combo.format)) err(`${combo.id}: ${c.id} doesn't support ${combo.format}`)
  if (sharedProfile(ok) === null) err(`${combo.id}: flavor profiles clash`)
  for (const p of combo.parts) {
    const c = lib.components.get(p.componentId)
    if (c && p.qty && ratio(p.qty, c.yield) == null) err(`${combo.id}: override unit for ${c.id} incompatible`)
  }
}

// ── Report ──
const targets = { kcal: 600, protein: 40, tolerance: 0.1 }
console.log(`\n${lib.foods.size} foods · ${lib.components.size} components · ${lib.combos.size} combos · version ${lib.version}\n`)
console.log('Combo'.padEnd(46), 'kcal'.padStart(5), 'prot'.padStart(5), '  status')
for (const combo of lib.combos.values()) {
  const { n } = partsNutrition(lib, combo.parts)
  console.log(combo.name.slice(0, 45).padEnd(46), n.kcal.toFixed(0).padStart(5), n.protein.toFixed(0).padStart(5), ' ', targetStatus(n, targets))
}
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ` + warnings.join('\n  '))
if (errors.length) {
  console.error(`\n✗ ${errors.length} error(s):\n  ` + errors.join('\n  '))
  process.exit(1)
}
console.log('\n✓ Library valid')
