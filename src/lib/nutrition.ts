import type { Component, ComboPart, Library, Nutrients, Targets } from './types'
import { ratio, toGrams, type Qty } from './units'

export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
const KEYS = Object.keys(ZERO) as (keyof Nutrients)[]

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const out = { ...a }
  for (const k of KEYS) out[k] += b[k]
  return out
}
export function scale(a: Nutrients, f: number): Nutrients {
  const out = { ...a }
  for (const k of KEYS) out[k] *= f
  return out
}

export interface NutritionResult {
  n: Nutrients
  /** Human-readable problems (unconvertible units, unknown foods). Empty = complete. */
  issues: string[]
  /** True when any contributing food uses label (non-USDA) nutrition. */
  approximate: boolean
}

const batchCache = new WeakMap<Component, NutritionResult>()

/** Nutrition for a full batch (the component's recipeYield). */
export function batchNutrition(lib: Library, c: Component): NutritionResult {
  const hit = batchCache.get(c)
  if (hit) return hit
  let n = { ...ZERO }
  const issues: string[] = []
  let approximate = false
  for (const s of c.supplies) {
    const food = lib.foods.get(s.foodId)
    if (!food) {
      issues.push(`Unknown food ${s.foodId}`)
      continue
    }
    const g = toGrams(s.qty, food)
    if (g == null) {
      issues.push(`Can't convert ${s.qty.value} ${s.qty.unit} of ${food.name} to grams`)
      continue
    }
    if (food.nutritionSource !== 'usda-sr-legacy') approximate = true
    n = add(n, scale(food.per100g, g / 100))
  }
  const res = { n, issues, approximate }
  batchCache.set(c, res)
  return res
}

/** Nutrition for a quantity of a component (defaults to its portion). */
export function componentNutrition(lib: Library, c: Component, qty: Qty = c.portion): NutritionResult {
  const b = batchNutrition(lib, c)
  const r = ratio(qty, c.yield)
  if (r == null) return { n: { ...ZERO }, issues: [...b.issues, `Portion unit ${qty.unit} incompatible with yield unit ${c.yield.unit}`], approximate: b.approximate }
  return { n: scale(b.n, r), issues: b.issues, approximate: b.approximate }
}

export function partsNutrition(lib: Library, parts: ComboPart[], overrides?: Record<string, Qty>): NutritionResult {
  let n = { ...ZERO }
  const issues: string[] = []
  let approximate = false
  for (const p of parts) {
    const c = lib.components.get(p.componentId)
    if (!c) {
      issues.push(`Missing component ${p.componentId}`)
      continue
    }
    const r = componentNutrition(lib, c, overrides?.[p.componentId] ?? p.qty ?? c.portion)
    n = add(n, r.n)
    issues.push(...r.issues)
    approximate ||= r.approximate
  }
  return { n, issues, approximate }
}

export type TargetStatus = 'hit' | 'low-protein' | 'over' | 'under'

export function targetStatus(n: Nutrients, t: Targets): TargetStatus {
  const lo = t.kcal * (1 - t.tolerance)
  const hi = t.kcal * (1 + t.tolerance)
  if (n.kcal > hi) return 'over'
  if (n.kcal < lo) return 'under'
  if (n.protein < t.protein) return 'low-protein'
  return 'hit'
}

export const hitsTarget = (n: Nutrients, t: Targets) => targetStatus(n, t) === 'hit'

/** Lower is better. 0 = exactly on kcal target with protein met. */
export function targetDistance(n: Nutrients, t: Targets): number {
  const kcal = Math.abs(n.kcal - t.kcal) / t.kcal
  const protein = Math.max(0, t.protein - n.protein) / t.protein
  return kcal + protein * 2
}
