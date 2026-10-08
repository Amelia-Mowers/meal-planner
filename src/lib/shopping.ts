import { resolveCombo } from './combos'
import type { Component, Food, Library, MenuItem } from './types'
import { convert, dimOf, formatQty, fromQV, humanize, ratio, toGrams, type Qty } from './units'

export const AISLES: Record<string, { label: string; order: number }> = {
  produce: { label: 'Produce', order: 0 },
  deli: { label: 'Deli', order: 1 },
  meat: { label: 'Meat', order: 2 },
  dairy: { label: 'Dairy & eggs', order: 3 },
  refrigerated: { label: 'Refrigerated', order: 4 },
  bakery: { label: 'Bakery', order: 5 },
  grains: { label: 'Rice, grains & pasta', order: 6 },
  canned: { label: 'Canned goods', order: 7 },
  international: { label: 'International', order: 8 },
  condiments: { label: 'Condiments & pickles', order: 9 },
  oils: { label: 'Oils & vinegars', order: 10 },
  spices: { label: 'Spices', order: 11 },
  baking: { label: 'Baking', order: 12 },
  snacks: { label: 'Nuts & snacks', order: 13 },
  breakfast: { label: 'Cereal & breakfast', order: 6.5 },
  frozen: { label: 'Frozen', order: 14 },
}
export const aisleLabel = (a: string) => AISLES[a]?.label ?? a.charAt(0).toUpperCase() + a.slice(1)
export const aisleOrder = (a: string) => AISLES[a]?.order ?? 50

/** Batch granularity: recipes scale in quarter batches. */
const BATCH_STEP = 0.25

/**
 * Smallest sensible batch. Long-keeping things (pickles, jars, shelf-stable toppers) are made
 * or bought whole; sauces don't go below half a batch.
 */
function minBatches(c: Component): number {
  if (c.fridgeDays == null || c.fridgeDays >= 14) return 1
  if (c.role === 'sauce') return 0.5
  return BATCH_STEP
}

export interface ComponentNeed {
  component: Component
  /** Amount the planned combos use, in the component's yield unit. */
  amount: number
  /** Batches to actually make (auto, or the user's adjustment). */
  batches: number
  /** Batches the planned combos call for, before any adjustment. */
  autoBatches: number
  /** Servings of planned combos that use this component. */
  servings: number
  /** True when the user set the batch count by hand. */
  adjusted: boolean
}

export const batchStep = () => BATCH_STEP

/**
 * The prep set: how much of each component the planned combos need, rounded up to sensible
 * batch sizes, then overridden by the user's per-component adjustments (absolute batch counts —
 * 0 skips a component, and components not used by any combo can be added as extras).
 */
export function componentNeeds(lib: Library, menu: MenuItem[], adjust: Record<string, number> = {}): Map<string, ComponentNeed> {
  const needs = new Map<string, ComponentNeed>()
  const bump = (c: Component, amount: number, servings: number) => {
    const cur = needs.get(c.id) ?? { component: c, amount: 0, batches: 0, autoBatches: 0, servings: 0, adjusted: false }
    cur.amount += amount
    cur.servings += servings
    needs.set(c.id, cur)
  }
  for (const item of menu) {
    if (item.servings <= 0) continue
    const combo = resolveCombo(lib, item.comboId)
    if (!combo) continue
    for (const p of combo.parts) {
      const c = lib.components.get(p.componentId)
      if (!c) continue
      const q = item.portions?.[c.id] ?? p.qty ?? c.portion
      const perServing = ratio(q, c.yield)
      if (perServing == null) continue
      bump(c, perServing * c.yield.value * item.servings, item.servings)
    }
  }
  for (const n of needs.values()) {
    const exact = Math.ceil(n.amount / n.component.yield.value / BATCH_STEP - 1e-9) * BATCH_STEP
    n.autoBatches = n.batches = Math.max(minBatches(n.component), exact)
  }
  for (const [id, b] of Object.entries(adjust)) {
    const c = lib.components.get(id)
    if (!c) continue
    const n = needs.get(id) ?? { component: c, amount: 0, batches: 0, autoBatches: 0, servings: 0, adjusted: false }
    n.batches = Math.max(0, b)
    n.adjusted = true
    needs.set(id, n)
  }
  return needs
}

/** Needs that will actually be made/bought. */
export const activeNeeds = (needs: Map<string, ComponentNeed>) =>
  new Map([...needs].filter(([, n]) => n.batches > 0))

export interface ShoppingItem {
  foodId: string
  name: string
  aisle: string
  /** e.g. "2 cans", "1 × 32 oz" */
  buy: string
  /** e.g. "about 1¾ cups" — what the recipes actually use. */
  need: string
  pantry: boolean
  /** Components that use this food. */
  usedBy: string[]
  /** True when some amounts couldn't be merged and are listed separately. */
  unmerged: boolean
}

interface Acc {
  food: Food | undefined
  foodId: string
  grams: number
  hasGrams: boolean
  /** Amounts that could not be converted to grams, summed within unit. */
  loose: Map<string, number>
  /** Dimension-preserving totals for a friendly "need" text. */
  byDim: Map<string, number>
  usedBy: Set<string>
}

export function shoppingList(lib: Library, needs: Map<string, ComponentNeed>): ShoppingItem[] {
  const acc = new Map<string, Acc>()
  for (const { component: c, batches } of needs.values()) {
    if (batches <= 0) continue
    for (const s of c.supplies) {
      const food = lib.foods.get(s.foodId)
      const a =
        acc.get(s.foodId) ??
        ({ food, foodId: s.foodId, grams: 0, hasGrams: false, loose: new Map(), byDim: new Map(), usedBy: new Set() } as Acc)
      const q = { value: s.qty.value * batches, unit: s.qty.unit }
      const g = toGrams(q, food)
      if (g != null) {
        a.grams += g
        a.hasGrams = true
      } else a.loose.set(q.unit, (a.loose.get(q.unit) ?? 0) + q.value)
      // Same-dimension sum for display: mass in g, volume in ml, counts by unit
      const d = dimOf(q.unit)
      const key = d === 'count' ? q.unit : d
      const base = d === 'mass' ? 'g' : d === 'volume' ? 'ml' : q.unit
      a.byDim.set(key, (a.byDim.get(key) ?? 0) + (convert(q, base) ?? 0))
      a.usedBy.add(c.name)
      acc.set(s.foodId, a)
    }
  }

  const items: ShoppingItem[] = []
  for (const a of acc.values()) {
    const food = a.food
    const need = [...a.byDim.entries()]
      .map(([k, v]) => formatQty(humanize({ value: v, unit: k === 'mass' ? 'g' : k === 'volume' ? 'ml' : k })))
      .join(' + ')
    let buy = need
    const buyUnit = food ? fromQV(food.buyUnit) : null
    if (buyUnit && a.hasGrams) {
      const pkg = toGrams(buyUnit, food)
      if (pkg) {
        // 3% slack so rounding noise doesn't add a whole extra package.
        const count = Math.max(1, Math.ceil(a.grams / pkg - 0.03))
        buy = describeBuy(count, buyUnit)
      }
    }
    if (a.loose.size) {
      const extra = [...a.loose.entries()].map(([u, v]) => formatQty({ value: v, unit: u })).join(' + ')
      buy = a.hasGrams ? `${buy} + ${extra}` : extra
    }
    items.push({
      foodId: a.foodId,
      name: food?.name ?? a.foodId,
      aisle: food?.aisle ?? 'other',
      buy,
      need,
      pantry: !!food?.pantry,
      usedBy: [...a.usedBy],
      unmerged: a.hasGrams && a.loose.size > 0,
    })
  }
  return items.sort((x, y) => aisleOrder(x.aisle) - aisleOrder(y.aisle) || x.name.localeCompare(y.name))
}

function describeBuy(count: number, unit: Qty): string {
  if (unit.value === 1) return formatQty({ value: count, unit: unit.unit })
  if (dimOf(unit.unit) === 'mass' && unit.unit === 'lb') return formatQty({ value: count * unit.value, unit: 'lb' })
  if (unit.unit === 'whole') return `${count} pack${count > 1 ? 's' : ''} of ${unit.value}`
  return `${count} × ${formatQty(unit)}`
}

export function groupByAisle<T extends { aisle: string }>(items: T[]): [string, T[]][] {
  const m = new Map<string, T[]>()
  for (const i of items) m.set(i.aisle, [...(m.get(i.aisle) ?? []), i])
  return [...m.entries()].sort((a, b) => aisleOrder(a[0]) - aisleOrder(b[0]))
}

export function listAsText(items: ShoppingItem[], have: Set<string>): string {
  const lines: string[] = []
  for (const [aisle, list] of groupByAisle(items.filter((i) => !have.has(i.foodId)))) {
    lines.push(aisleLabel(aisle).toUpperCase())
    for (const i of list) lines.push(`☐ ${i.name} — ${i.buy}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
