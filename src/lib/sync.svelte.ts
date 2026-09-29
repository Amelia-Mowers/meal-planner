import { resolveCombo } from './combos'
import type { HandoffPayload } from './handoff'
import type { Period } from './period'
import { groupByAisle } from './shopping'
import { app, type PastPeriod } from './store.svelte'
import type { Qty } from './units'

const shortCombo = (id: string) => id.replace(/^combo\//, '')
const longCombo = (id: string) => (id.includes('/') ? id : `combo/${id}`)
const shortComp = (id: string) => id.replace(/^comp\//, '')
const longComp = (s: string) => `comp/${s}`

/** Everything the phone needs to carry this period: plan, adjustments, and a fallback list. */
export function buildPayload(): HandoffPayload | null {
  const p = app.period
  if (!p) return null
  const have = new Set(app.have)
  // The phone rebuilds everything from its own library; a precomputed list only helps when the
  // plan uses private recipes, which the phone may not have.
  const usesPrivate = [...app.needs.values()].some((n) => n.batches > 0 && n.component.source === 'private')
  return {
    v: app.lib.version,
    p: p.name ? [p.id, p.start, p.days, p.mealsPerDay, p.name] : [p.id, p.start, p.days, p.mealsPerDay],
    m: app.menu.map((m) => {
      const ov = Object.entries(app.portions[m.comboId] ?? {}).map(([c, q]) => [shortComp(c), q.value, q.unit] as [string, number, string])
      return ov.length ? [shortCombo(m.comboId), m.servings, ov] : [shortCombo(m.comboId), m.servings]
    }),
    a: Object.entries(app.adjust).map(([c, b]) => [shortComp(c), b]),
    ...(usesPrivate
      ? {
          s: groupByAisle(app.shopping.filter((i) => !have.has(i.foodId))).map(
            ([aisle, items]) => [aisle, items.map((i) => [i.name, i.buy] as [string, string])] as [string, [string, string][]],
          ),
        }
      : {}),
  }
}

export function payloadToPlan(x: HandoffPayload): PastPeriod {
  const [id, start, days, mealsPerDay, name] = x.p
  const period: Period = { id, start, days, mealsPerDay, ...(name ? { name } : {}) }
  const portions: Record<string, Record<string, Qty>> = {}
  const menu = x.m.map(([c, servings, ov]) => {
    const comboId = longCombo(c)
    if (ov?.length) portions[comboId] = Object.fromEntries(ov.map(([s, value, unit]) => [longComp(s), { value, unit }]))
    return { comboId, servings }
  })
  return { period, menu, adjust: Object.fromEntries(x.a.map(([s, b]) => [longComp(s), b])), portions }
}

/** What won't resolve on this device (older library or private recipes). */
export function missingOnThisDevice(plan: PastPeriod): string[] {
  const missing = plan.menu.filter((m) => !resolveCombo(app.lib, m.comboId)).map((m) => m.comboId)
  for (const id of Object.keys(plan.adjust)) if (!app.lib.components.has(id)) missing.push(id)
  return missing
}

/**
 * Replace this device's current period with the synced one. Re-syncing the same period keeps
 * shopping and prep checkmarks; a different period archives the current one first.
 */
export function applySync(plan: PastPeriod) {
  if (app.period?.id === plan.period.id) {
    app.period = plan.period
    app.menu = plan.menu
    app.adjust = plan.adjust
    app.portions = plan.portions
  } else {
    app.startPeriod(plan.period, plan)
  }
}
