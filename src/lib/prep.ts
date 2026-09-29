import type { ComponentNeed } from './shopping'
import type { Component } from './types'
import { formatQty, humanize, toGrams } from './units'

export type Lane = 'oven' | 'stove' | 'rice' | 'micro' | 'counter'

export const LANES: Record<Lane, { label: string; hint: string }> = {
  oven: { label: 'Oven', hint: '425°F / 220°C' },
  rice: { label: 'Rice cooker', hint: 'Set and forget' },
  stove: { label: 'Stovetop', hint: 'Burners' },
  micro: { label: 'Microwave', hint: 'Quick steams & thaws' },
  counter: { label: 'Counter', hint: 'No-cook: sauces, pickles, chopping' },
}
const LANE_ORDER: Lane[] = ['oven', 'rice', 'stove', 'micro', 'counter']

export interface PrepTask {
  id: string
  lane: Lane
  title: string
  detail: string
  components: Component[]
  activeMin: number
  handsOffMin: number
  steps: string[]
  /** Lower runs earlier within its lane. */
  priority: number
  fridgeDays: number | null
  freezable: boolean
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

const BATCH_WORDS: Record<number, string> = { 0.25: '¼ batch', 0.5: '½ batch', 0.75: '¾ batch', 1: '1 batch', 1.5: '1½ batches' }
const batchText = (b: number) => BATCH_WORDS[b] ?? `${b} batches`

export function prepPlan(needs: Map<string, ComponentNeed>): { tasks: PrepTask[]; byLane: [Lane, PrepTask[]][]; estimateMin: number } {
  const tasks: PrepTask[] = []
  const groups = new Map<string, ComponentNeed[]>()
  for (const n of needs.values()) {
    const c = n.component
    // No-prep items (tortillas, pita, jarred things with 0 prep) don't need a task.
    if (c.prepMin === 0 && c.cookMin === 0) continue
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
      steps: [
        `Brown all the turkey in your largest skillet over medium-high heat, breaking it up, until no pink remains and it reaches 165°F / 74°C (about 10 minutes).`,
        `Divide into ${cs.length} portions by weight.`,
        ...cs.map((c) => `${c.name}: ${c.steps.slice(1).join(' ')}`),
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
  const active = tasks.reduce((s, t) => s + t.activeMin, 0)
  const longestLane = Math.max(0, ...byLane.map(([, ts]) => ts.reduce((s, t) => s + t.activeMin + t.handsOffMin, 0)))
  const estimateMin = Math.round(Math.max(active, longestLane) / 5) * 5 + (tasks.length ? 10 : 0)
  return { tasks, byLane, estimateMin }
}

/** Components ordered by how soon they should be eaten. */
export function eatOrder(needs: Map<string, ComponentNeed>) {
  return [...needs.values()]
    .map((n) => n.component)
    .filter((c) => c.fridgeDays != null && c.fridgeDays < 7)
    .sort((a, b) => (a.fridgeDays ?? 99) - (b.fridgeDays ?? 99))
}
