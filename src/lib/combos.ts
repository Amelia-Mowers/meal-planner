import { partsNutrition, targetDistance, type NutritionResult } from './nutrition'
import { slug } from './library'
import type { Combo, ComboPart, Component, Format, Library, Role, Targets } from './types'
import { ratio, type Qty } from './units'

export const FORMATS: Format[] = ['bowl', 'wrap']
const ROLE_ORDER: Record<Role, number> = { base: 0, protein: 1, veg: 2, sauce: 3, topper: 4 }
const MAX_VEG = 4

// ───────────── Flavor compatibility ─────────────

const flavors = (c: Component) => c.cuisines.filter((x) => x !== 'neutral')
const isNeutral = (c: Component) => c.cuisines.includes('neutral') || flavors(c).length === 0

/**
 * The flavor profile shared by a set of components, or null if incompatible.
 * Neutral components are wildcards. Returns [] when everything is neutral.
 */
export function sharedProfile(cs: Component[]): string[] | null {
  let profile: string[] | null = null
  for (const c of cs) {
    if (isNeutral(c)) continue
    const f = flavors(c)
    profile = profile ? profile.filter((x) => f.includes(x)) : f
    if (!profile.length) return null
  }
  return profile ?? []
}

const fitsFormat = (c: Component, f: Format) => c.formats.includes(f)

// ───────────── IDs for generated combos ─────────────
// gen/<format>/<slug>+<slug>+… — parts in role order. Portable across devices because it
// only references component IDs.

export function genId(format: Format, parts: ComboPart[]): string {
  return `gen/${format}/${parts.map((p) => slug(p.componentId)).join('+')}`
}

export function resolveCombo(lib: Library, id: string): Combo | null {
  const curated = lib.combos.get(id)
  if (curated) return curated
  const m = /^gen\/(bowl|wrap)\/(.+)$/.exec(id)
  if (!m) return null
  const parts = m[2].split('+').map((s) => ({ componentId: `comp/${s}` }))
  if (parts.some((p) => !lib.components.has(p.componentId))) return null
  return makeGenerated(lib, m[1] as Format, parts)
}

function makeGenerated(lib: Library, format: Format, parts: ComboPart[]): Combo {
  const cs = parts.map((p) => lib.components.get(p.componentId)!)
  const protein = cs.find((c) => c.role === 'protein' && !c.secondary) ?? cs.find((c) => c.role === 'protein')
  const sauce = cs.find((c) => c.role === 'sauce')
  const profile = sharedProfile(cs) ?? []
  const noun = format === 'bowl' ? 'bowl' : 'wrap'
  const name = protein ? `${protein.shortName} ${noun}` : `Veggie ${noun}`
  return {
    id: genId(format, parts),
    name: sauce ? `${name} with ${sauce.shortName}` : name,
    description: '',
    format,
    cuisine: profile[0] ?? 'neutral',
    parts,
    curated: false,
    tested: false,
    source: cs.some((c) => c.source === 'private') ? 'private' : 'bundled',
  }
}

// ───────────── Suggestions ─────────────

export interface Suggestion {
  combo: Combo
  nutrition: NutritionResult
  distance: number
  /** For curated combos: components not in the prep set. */
  missing: string[]
}

export function nutritionOf(lib: Library, combo: Combo, overrides?: Record<string, Qty>) {
  return partsNutrition(lib, combo.parts, overrides)
}

/**
 * All combos satisfiable by the prep set: curated first, then generated ones ranked by
 * closeness to the nutrition target. Curated combos missing exactly one component are
 * returned separately so the UI can suggest adding it.
 */
export function suggest(
  lib: Library,
  prepSet: Set<string>,
  targets: Targets,
  format: Format | 'all' = 'all',
): { curated: Suggestion[]; generated: Suggestion[]; almost: Suggestion[] } {
  const formats = format === 'all' ? FORMATS : [format]
  const curated: Suggestion[] = []
  const almost: Suggestion[] = []
  const curatedKeys = new Set<string>()

  for (const combo of lib.combos.values()) {
    if (!formats.includes(combo.format)) continue
    const missing = combo.parts.map((p) => p.componentId).filter((id) => !prepSet.has(id))
    if (missing.length > 1) continue
    const nutrition = nutritionOf(lib, combo)
    const s = { combo, nutrition, distance: targetDistance(nutrition.n, targets), missing }
    if (missing.length === 0) {
      curated.push(s)
      curatedKeys.add(partsKey(combo.format, combo.parts))
    } else if (prepSet.size) almost.push(s)
  }
  curated.sort((a, b) => a.distance - b.distance)
  almost.sort((a, b) => a.distance - b.distance)

  const generated: Suggestion[] = []
  const set = [...prepSet].map((id) => lib.components.get(id)).filter((c): c is Component => !!c)
  for (const f of formats) {
    for (const s of generate(lib, set, f, targets)) {
      if (curatedKeys.has(partsKey(f, s.combo.parts))) continue
      generated.push(s)
    }
  }
  generated.sort((a, b) => a.distance - b.distance)
  return { curated, generated: generated.slice(0, 80), almost: almost.slice(0, 6) }
}

const partsKey = (f: Format, parts: ComboPart[]) => f + ':' + parts.map((p) => p.componentId).sort().join(',')

function generate(lib: Library, set: Component[], f: Format, targets: Targets): Suggestion[] {
  const by = (role: Role) => set.filter((c) => c.role === role && fitsFormat(c, f))
  const bases = by('base')
  const allProteins = by('protein')
  const primaries = allProteins.filter((c) => !c.secondary)
  const proteins = primaries.length ? primaries : allProteins
  const secondaries = allProteins.filter((c) => c.secondary && !proteins.includes(c))
  const sauces = by('sauce')
  const vegs = by('veg').sort(vegOrder)
  const toppers = by('topper')
  const out: Suggestion[] = []

  for (const base of bases)
    for (const protein of proteins)
      for (const sauce of sauces) {
        const core = [base, protein, sauce]
        const profile = sharedProfile(core)
        if (!profile) continue
        const veg = vegs.filter((v) => sharedProfile([...core, v]) !== null).slice(0, MAX_VEG)
        if (!veg.length) continue
        const fullProfile = sharedProfile([...core, ...veg])
        if (!fullProfile) continue
        // Prefer a topper that shares the profile explicitly, then a neutral one.
        const topper =
          toppers.find((t) => !isNeutral(t) && sharedProfile([...core, ...veg, t])?.length) ??
          toppers.find((t) => sharedProfile([...core, ...veg, t]) !== null)

        const options: Component[][] = [[]]
        for (const s of secondaries) if (sharedProfile([...core, ...veg, s]) !== null) options.push([s])

        let best: Suggestion | null = null
        for (const extra of options) {
          const cs = [base, protein, ...extra, ...veg, sauce, ...(topper ? [topper] : [])]
          cs.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
          const parts = cs.map((c) => ({ componentId: c.id }))
          const combo = makeGenerated(lib, f, parts)
          const nutrition = nutritionOf(lib, combo)
          const s = { combo, nutrition, distance: targetDistance(nutrition.n, targets), missing: [] }
          if (!best || s.distance < best.distance) best = s
        }
        if (best) out.push(best)
      }
  return out
}

/** Fresh crunchy veg first, then cooked, then pickled — so the cap keeps variety. */
function vegOrder(a: Component, b: Component) {
  const rank = (c: Component) => (c.keywords.includes('pickled') ? 2 : c.keywords.includes('cooked') ? 1 : 0)
  return rank(a) - rank(b)
}

// ───────────── Portion fitting ─────────────

/** The part that flexes to hit the target: the base (carb). */
export function flexPart(lib: Library, combo: Combo): Component | undefined {
  return combo.parts.map((p) => lib.components.get(p.componentId)).find((c) => c?.role === 'base')
}

/**
 * Base portion (in the base's portion unit) that brings kcal closest to target, clamped to
 * the component's portionRange and snapped to its slider step.
 */
export function fitBasePortion(lib: Library, combo: Combo, targets: Targets, overrides: Record<string, Qty> = {}): Qty | null {
  const base = flexPart(lib, combo)
  if (!base || !base.portionRange) return null
  const part = combo.parts.find((p) => p.componentId === base.id)!
  const cur = overrides[base.id] ?? part.qty ?? base.portion
  const unit = base.portion.unit
  const curVal = ratio(cur, { value: 1, unit })
  if (curVal == null) return null
  const withBase = nutritionOf(lib, combo, { ...overrides, [base.id]: { value: curVal, unit } }).n.kcal
  const without = nutritionOf(lib, combo, { ...overrides, [base.id]: { value: 0, unit } }).n.kcal
  const perUnit = curVal ? (withBase - without) / curVal : 0
  if (perUnit <= 0) return null
  const [lo, hi] = base.portionRange
  const step = sliderStep(base)
  const raw = (targets.kcal - without) / perUnit
  const snapped = Math.round(raw / step) * step
  return { value: Math.min(hi, Math.max(lo, snapped)), unit }
}

export function sliderStep(c: Component): number {
  const [lo, hi] = c.portionRange ?? [c.portion.value, c.portion.value]
  const span = hi - lo
  if (c.portion.unit === 'g') return span >= 100 ? 25 : 5
  if (c.portion.unit === 'whole') return span >= 2 ? 1 : 0.5
  return 0.25
}
