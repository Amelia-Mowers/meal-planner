import type { ComponentNeed } from './shopping'
import type { Component, Food, Library, Supply } from './types'
import { dimOf, formatNumber, formatQty, humanize, toGrams, type Qty } from './units'

export type Lane = 'oven' | 'stove' | 'rice' | 'micro' | 'counter'

export const LANES: Record<Lane, { label: string; hint: string }> = {
  oven: { label: 'Oven', hint: '425°F / 220°C' },
  rice: { label: 'Rice cooker', hint: 'Set and forget' },
  stove: { label: 'Stovetop', hint: 'Burners' },
  micro: { label: 'Microwave', hint: 'Quick steams & thaws' },
  counter: { label: 'Counter', hint: 'No-cook: sauces, pickles, chopping' },
}
const LANE_ORDER: Lane[] = ['oven', 'rice', 'stove', 'micro', 'counter']
const STOVE_BURNERS = 3

export interface PrepTask {
  id: string
  lane: Lane
  title: string
  detail: string
  components: Component[]
  activeMin: number
  handsOffMin: number
  /** Ingredients scaled to the batch count, optionally grouped under headings. */
  ingredients: IngredientGroup[]
  steps: string[]
  /** Lower runs earlier within its lane. */
  priority: number
  fridgeDays: number | null
  freezable: boolean
}

export interface IngredientLine {
  amount: string
  name: string
  note?: string
}
export interface IngredientGroup {
  heading?: string
  items: IngredientLine[]
}

/** Scale a recipe quantity and keep it readable (volumes re-unit, grams round). */
export function scaleQty(q: Qty, factor: number): Qty {
  const v = q.value * factor
  const d = dimOf(q.unit)
  if (d === 'volume') return humanize({ value: v, unit: q.unit })
  if (q.unit === 'g') return { value: v >= 20 ? Math.round(v / 5) * 5 : Math.round(v), unit: 'g' }
  return { value: v, unit: q.unit }
}

function lines(supplies: Supply[], factor: number, foods: Map<string, Food>): IngredientLine[] {
  return supplies.map((s) => ({
    amount: formatQty(scaleQty(s.qty, factor)),
    name: foods.get(s.foodId)?.name ?? s.foodId,
    note: s.description,
  }))
}

function laneFor(c: Component): Lane {
  const t = c.tools.map((x) => x.toLowerCase())
  if (t.includes('oven')) return 'oven'
  if (t.includes('rice cooker')) return 'rice'
  if (t.includes('stovetop')) return 'stove'
  if (t.includes('microwave')) return 'micro'
  return 'counter'
}

/**
 * Counter work order: pickles first (they need time), then sauces, then chopping.
 * Hot lanes: longest cook first so everything finishes together.
 */
function priority(c: Component, lane: Lane): number {
  if (lane !== 'counter') return -(c.cookMin + c.prepMin)
  if (c.keywords.includes('pickled')) return 0
  if (c.role === 'sauce') return 1
  if (c.role === 'protein') return 2
  if (c.role === 'veg') return 3
  return 4
}

export const batchText = (b: number) => (b === 1 ? '1 batch' : b < 1 ? `${formatNumber(b)} batch` : `${formatNumber(b)} batches`)

export function prepPlan(needs: Map<string, ComponentNeed>, lib?: Library): { tasks: PrepTask[]; byLane: [Lane, PrepTask[]][]; estimateMin: number } {
  const tasks: PrepTask[] = []
  const groups = new Map<string, ComponentNeed[]>()
  const foods = lib?.foods ?? new Map<string, Food>()
  for (const n of needs.values()) {
    const c = n.component
    // Skipped components, and no-prep items (tortillas, jarred things) don't need a task.
    if (n.batches <= 0 || (c.prepMin === 0 && c.cookMin === 0)) continue
    if (c.batchGroup) {
      groups.set(c.batchGroup, [...(groups.get(c.batchGroup) ?? []), n])
      continue
    }
    const lane = laneFor(c)
    tasks.push({
      id: c.id,
      lane,
      title: c.name,
      detail: `${batchText(n.batches)} · makes ${formatQty(humanize({ value: c.yield.value * n.batches, unit: c.yield.unit }))}`,
      components: [c],
      activeMin: c.prepMin,
      handsOffMin: c.cookMin,
      ingredients: [{ items: lines(c.supplies, n.batches, foods) }],
      steps: c.steps,
      priority: priority(c, lane),
      fridgeDays: c.fridgeDays,
      freezable: c.freezable,
    })
  }

  // Batch groups (e.g. one big pan of ground turkey split into flavors).
  for (const [group, ns] of groups) {
    const cs = ns.map((n) => n.component)
    const lane = laneFor(cs[0])
    const title = group === 'ground-turkey' ? 'Brown the turkey batch' : `Batch: ${group}`
    const shared = cs[0].supplies[0]
    const grams = ns.reduce((sum, n) => {
      const sup = n.component.supplies.find((x) => x.foodId === shared.foodId)
      return sum + (sup ? (toGrams(sup.qty) ?? 0) * n.batches : 0)
    }, 0)
    tasks.push({
      id: `group/${group}`,
      lane,
      title,
      detail:
        cs.length > 1
          ? `${formatQty(humanize({ value: grams, unit: 'g' }))} total → split into ${cs.map((c) => c.shortName.toLowerCase()).join(', ')}`
          : `${formatQty(humanize({ value: grams, unit: 'g' }))} → ${cs[0].name.toLowerCase()}`,
      components: cs,
      activeMin: Math.max(...cs.map((c) => c.prepMin)) + 5 * (cs.length - 1),
      handsOffMin: Math.max(...cs.map((c) => c.cookMin)) + 3 * (cs.length - 1),
      ingredients: [
        {
          heading: 'Batch',
          items: [
            {
              amount: formatQty(humanize({ value: grams, unit: 'g' })),
              name: foods.get(shared.foodId)?.name ?? shared.foodId,
              note: `${Math.round(grams / 5) * 5} g`,
            },
          ],
        },
        ...ns.map((n) => ({
          heading: n.component.shortName,
          items: lines(
            n.component.supplies.filter((x) => x.foodId !== shared.foodId),
            n.batches,
            foods,
          ),
        })),
      ],
      steps: [
        `Brown all the turkey in your largest skillet over medium-high heat, breaking it up, until no pink remains and it reaches 165°F / 74°C (about 10 minutes).`,
        ...(cs.length > 1
          ? [`Divide into ${cs.length} portions by weight.`, ...cs.map((c) => `${c.name}: ${c.steps.slice(1).join(' ')}`)]
          : cs[0].steps.slice(1)),
      ],
      priority: -99,
      fridgeDays: Math.min(...cs.map((c) => c.fridgeDays ?? 99)),
      freezable: cs.every((c) => c.freezable),
    })
  }

  tasks.sort((a, b) => LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane) || a.priority - b.priority)
  const byLane = LANE_ORDER.map((l) => [l, tasks.filter((t) => t.lane === l)] as [Lane, PrepTask[]]).filter(
    ([, ts]) => ts.length,
  )

  // Rough wall-clock: hands-on work is serial (one cook), hands-off time overlaps with it.
  // A stovetop runs several pots at once; other lanes are one appliance each.
  const active = tasks.reduce((s, t) => s + t.activeMin, 0)
  const laneTime = (lane: Lane, ts: PrepTask[]) => {
    const total = ts.reduce((s, t) => s + t.activeMin + t.handsOffMin, 0)
    if (lane !== 'stove') return total
    return Math.max(total / STOVE_BURNERS, ...ts.map((t) => t.activeMin + t.handsOffMin))
  }
  const longestLane = Math.max(0, ...byLane.map(([lane, ts]) => laneTime(lane, ts)))
  const estimateMin = Math.round(Math.max(active, longestLane) / 5) * 5 + (tasks.length ? 10 : 0)
  return { tasks, byLane, estimateMin }
}

/** Components ordered by how soon they should be eaten. */
export function eatOrder(needs: Map<string, ComponentNeed>) {
  return [...needs.values()]
    .filter((n) => n.batches > 0)
    .map((n) => n.component)
    .filter((c) => c.fridgeDays != null && c.fridgeDays < 7)
    .sort((a, b) => (a.fridgeDays ?? 99) - (b.fridgeDays ?? 99))
}
