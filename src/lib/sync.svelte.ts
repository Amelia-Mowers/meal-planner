import { resolveCombo } from './combos'
import type { HandoffPayload } from './handoff'
import type { Period } from './period'
import { groupByAisle } from './shopping'
import { app, MARK_LISTS, type MarkList, type PastPeriod } from './store.svelte'
import type { Qty } from './units'

const shortCombo = (id: string) => id.replace(/^combo\//, '')
const longCombo = (id: string) => (id.includes('/') ? id : `combo/${id}`)
const shortComp = (id: string) => id.replace(/^comp\//, '')
const longComp = (s: string) => `comp/${s}`

const LIST_CODE: Record<MarkList, string> = { inCart: 'c', have: 'h', prepDone: 'd' }
const CODE_LIST = Object.fromEntries(Object.entries(LIST_CODE).map(([l, c]) => [c, l])) as Record<string, MarkList>
// Cart/have hold food IDs; prepDone holds task IDs (comp/… or group/…).
const shortMark = (list: MarkList, id: string) => (list === 'prepDone' ? shortComp(id) : id.replace(/^food\//, ''))
const longMark = (list: MarkList, id: string) => (list === 'prepDone' ? (id.includes('/') ? id : longComp(id)) : `food/${id}`)
const secs = (ms: number) => Math.round(ms / 1000)

export interface Mark {
  list: MarkList
  id: string
  on: boolean
  /** ms; 0 = no recorded change (e.g. pantry defaults) */
  at: number
}

/** The whole period: plan + checkmarks, plus a fallback list when private recipes are involved. */
export function buildPayload(): HandoffPayload | null {
  const p = app.period
  if (!p) return null
  const have = new Set(app.have)
  const usesPrivate = [...app.needs.values()].some((n) => n.batches > 0 && n.component.source === 'private')

  const k: NonNullable<HandoffPayload['k']> = []
  for (const list of MARK_LISTS) {
    const on = new Set(app[list])
    const ids = new Set([...on, ...Object.keys(app.markTimes).filter((key) => key.startsWith(list + '|')).map((key) => key.slice(list.length + 1))])
    for (const id of ids) {
      const at = app.markTimes[`${list}|${id}`] ?? 0
      // Untouched pantry defaults are identical on every device — no need to send them.
      if (!at && list === 'have') continue
      k.push([LIST_CODE[list], shortMark(list, id), on.has(id) ? 1 : 0, secs(at)])
    }
  }

  return {
    v: app.lib.version,
    p: p.name ? [p.id, p.start, p.days, p.mealsPerDay, p.name] : [p.id, p.start, p.days, p.mealsPerDay],
    m: app.menu.map((m) => {
      const ov = Object.entries(app.portions[m.comboId] ?? {}).map(([c, q]) => [shortComp(c), q.value, q.unit] as [string, number, string])
      return ov.length ? [shortCombo(m.comboId), m.servings, ov] : [shortCombo(m.comboId), m.servings]
    }),
    a: Object.entries(app.adjust).map(([c, b]) => [shortComp(c), b]),
    u: secs(app.planUpdatedAt),
    ...(k.length ? { k } : {}),
    ...(usesPrivate
      ? {
          s: groupByAisle(app.shopping.filter((i) => !have.has(i.foodId))).map(
            ([aisle, items]) => [aisle, items.map((i) => [i.name, i.buy] as [string, string])] as [string, [string, string][]],
          ),
        }
      : {}),
  }
}

export interface IncomingSync {
  plan: PastPeriod
  /** ms */
  updatedAt: number
  marks: Mark[]
}

export function decodeIncoming(x: HandoffPayload): IncomingSync {
  const [id, start, days, mealsPerDay, name] = x.p
  const period: Period = { id, start, days, mealsPerDay, ...(name ? { name } : {}) }
  const portions: Record<string, Record<string, Qty>> = {}
  const menu = x.m.map(([c, servings, ov]) => {
    const comboId = longCombo(c)
    if (ov?.length) portions[comboId] = Object.fromEntries(ov.map(([s, value, unit]) => [longComp(s), { value, unit }]))
    return { comboId, servings }
  })
  const marks = (x.k ?? [])
    .filter(([code]) => CODE_LIST[code])
    .map(([code, id, on, t]) => {
      const list = CODE_LIST[code]
      return { list, id: longMark(list, id), on: on === 1, at: t * 1000 }
    })
  return {
    plan: { period, menu, adjust: Object.fromEntries(x.a.map(([s, b]) => [longComp(s), b])), portions },
    updatedAt: (x.u ?? 0) * 1000,
    marks,
  }
}

/** What won't resolve on this device (older library or private recipes). */
export function missingOnThisDevice(plan: PastPeriod): string[] {
  const missing = plan.menu.filter((m) => !resolveCombo(app.lib, m.comboId)).map((m) => m.comboId)
  for (const id of Object.keys(plan.adjust)) if (!app.lib.components.has(id)) missing.push(id)
  return missing
}

/** Which incoming checkmarks would change this device (newest change wins, per item). */
export function markChanges(marks: Mark[]): Mark[] {
  return marks.filter((m) => {
    const mine = app.markTimes[`${m.list}|${m.id}`] ?? 0
    const cur = app[m.list].includes(m.id)
    if (cur === m.on) return false
    // Untimed incoming marks only fill in; they never undo a local change.
    return m.at > mine || (m.at === 0 && mine === 0 && m.on)
  })
}

export interface SyncPreview {
  samePeriod: boolean
  /** Same period: whose plan is newer. */
  planFrom: 'theirs' | 'mine' | 'equal'
  marks: Mark[]
}

export function preview(inc: IncomingSync): SyncPreview {
  const samePeriod = app.period?.id === inc.plan.period.id
  if (!samePeriod) return { samePeriod, planFrom: 'theirs', marks: inc.marks.filter((m) => m.on || m.list === 'have') }
  const planFrom = samePlan(inc.plan) ? 'equal' : inc.updatedAt > app.planUpdatedAt ? 'theirs' : 'mine'
  return { samePeriod, planFrom, marks: markChanges(inc.marks) }
}

function samePlan(p: PastPeriod) {
  const mine = app.snapshot()
  const norm = (x: PastPeriod | null) => JSON.stringify(x && [x.period, x.menu, x.adjust, x.portions])
  return norm(mine) === norm(p)
}

/**
 * Same period: merge — the newer plan wins, and each checkmark takes whichever device changed
 * it last. Different period: archive the current one and adopt the incoming plan.
 */
export function applySync(inc: IncomingSync) {
  const pv = preview(inc)
  app.withoutStamps(() => {
    if (!pv.samePeriod) app.startPeriod(inc.plan.period, inc.plan)
    if (pv.planFrom === 'theirs') {
      app.period = inc.plan.period
      app.menu = inc.plan.menu
      app.adjust = inc.plan.adjust
      app.portions = inc.plan.portions
      app.planUpdatedAt = inc.updatedAt || Date.now()
    }
    const times = { ...app.markTimes }
    for (const m of pv.marks) {
      const set = new Set(app[m.list])
      if (m.on) set.add(m.id)
      else set.delete(m.id)
      app[m.list] = [...set]
      times[`${m.list}|${m.id}`] = m.at
    }
    app.markTimes = times
  })
  return pv
}
