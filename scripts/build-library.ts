/**
 * Expands data/library.source.ts into schema.org Recipe JSON-LD at src/data/library.jsonld.
 *   npm run build:library
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { combos, components, type Supply } from '../data/library.source'
import { fnv1a, MP_CONTEXT, minutesIso } from '../src/lib/library'
import type { Food, RecipeDoc } from '../src/lib/types'
import { formatIngredient, normUnit, toQV } from '../src/lib/units'

const ROOT = new URL('..', import.meta.url).pathname
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
const AUTHOR = { '@type': 'Organization', name: 'Meal Planner starter library (AI-generated)' }

const foods = new Map<string, Food>(
  (JSON.parse(readFileSync(join(ROOT, 'src/data/foods.json'), 'utf8')).foods as Food[]).map((f) => [f.id, f]),
)
const q = (value: number, unit: string) => ({ value, unit: normUnit(unit) })

function supplyDoc([foodId, value, unit, description]: Supply) {
  const food = foods.get(foodId)
  if (!food) throw new Error(`Unknown food ${foodId}`)
  return {
    '@type': 'HowToSupply' as const,
    name: food.name,
    ...(description ? { description } : {}),
    identifier: foodId,
    requiredQuantity: toQV(q(value, unit)),
  }
}

const graph: RecipeDoc[] = []

for (const c of components) {
  const usesLabelFood = c.supply.some(([id]) => foods.get(id)?.needsReview)
  const doc: RecipeDoc = {
    '@type': 'Recipe',
    '@id': `comp/${c.slug}`,
    name: c.name,
    ...(c.shortName ? { alternateName: c.shortName } : {}),
    description: c.description,
    recipeCategory: c.role,
    recipeCuisine: c.cuisines,
    keywords: c.keywords?.join(', '),
    'mp:formats': c.formats,
    'mp:portion': toQV(q(...c.portion)),
    ...(c.portionRange ? { 'mp:portionRange': { minValue: c.portionRange[0], maxValue: c.portionRange[1] } } : {}),
    recipeYield: toQV(q(...c.yield)),
    recipeIngredient: c.supply.map(([id, v, u, d]) => formatIngredient(q(v, u), foods.get(id)!.name, d)),
    supply: c.supply.map(supplyDoc),
    ...(c.tools?.length ? { tool: c.tools.map((name) => ({ '@type': 'HowToTool' as const, name })) } : {}),
    recipeInstructions: c.steps.map((text) => ({ '@type': 'HowToStep' as const, text })),
    prepTime: minutesIso(c.prepTime),
    ...(c.cookTime ? { cookTime: minutesIso(c.cookTime) } : {}),
    totalTime: minutesIso(c.prepTime + (c.cookTime ?? 0)),
    author: AUTHOR,
    license: CC0,
    'mp:tested': false,
    'mp:needsReview': usesLabelFood,
    'mp:fridgeDays': c.fridgeDays,
    'mp:freezable': c.freezable,
    'mp:serve': c.serve,
    ...(c.secondary ? { 'mp:secondary': true } : {}),
    ...(c.batchGroup ? { 'mp:batchGroup': c.batchGroup } : {}),
  }
  if (!doc.keywords) delete doc.keywords
  graph.push(doc)
}

const compNames = new Map(components.map((c) => [`comp/${c.slug}`, c.name]))
for (const c of combos) {
  graph.push({
    '@type': 'Recipe',
    '@id': `combo/${c.slug}`,
    name: c.name,
    description: c.description,
    recipeCategory: 'combo',
    recipeCuisine: c.cuisine,
    'mp:format': c.format,
    recipeIngredient: c.parts.map((p) => compNames.get(`comp/${typeof p === 'string' ? p : p[0]}`) ?? '?'),
    supply: c.parts.map((p) =>
      typeof p === 'string'
        ? { '@type': 'HowToSupply' as const, identifier: `comp/${p}` }
        : { '@type': 'HowToSupply' as const, identifier: `comp/${p[0]}`, requiredQuantity: toQV(q(p[1], p[2])) },
    ),
    author: AUTHOR,
    license: CC0,
    'mp:tested': false,
  })
}

const version = fnv1a(JSON.stringify(graph) + JSON.stringify([...foods.values()].map((f) => [f.id, f.per100g])))
const out = { '@context': MP_CONTEXT, 'mp:version': version, '@graph': graph }
writeFileSync(join(ROOT, 'src/data/library.jsonld'), JSON.stringify(out, null, 2) + '\n')
console.log(`Wrote ${components.length} components and ${combos.length} combos (version ${version})`)
