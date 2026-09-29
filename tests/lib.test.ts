import { describe, expect, it } from 'vitest'
import foodsJson from '../src/data/foods.json'
import libraryJson from '../src/data/library.jsonld?raw'
import * as b45 from '../src/lib/base45'
import { fitBasePortion, resolveCombo, sharedProfile, suggest } from '../src/lib/combos'
import { decodePayload, encodePayload, readFragment, type HandoffPayload } from '../src/lib/handoff'
import { buildLibrary, isoMinutes, minutesIso } from '../src/lib/library'
import { componentNutrition, partsNutrition, targetStatus } from '../src/lib/nutrition'
import { eatOrder, prepPlan } from '../src/lib/prep'
import { componentNeeds, shoppingList } from '../src/lib/shopping'
import { endDate, mealsTarget, nextPeriod, periodStatus } from '../src/lib/period'
import { distribute, STARTER_PLANS } from '../src/lib/starterSets'
import type { Food, LibraryFile } from '../src/lib/types'
import { convert, formatNumber, formatQty, humanize, normUnit, toGrams } from '../src/lib/units'

const lib = buildLibrary(foodsJson.foods as Food[], JSON.parse(libraryJson) as LibraryFile)
const targets = { kcal: 600, protein: 40, tolerance: 0.1 }

describe('units', () => {
  it('normalizes UN/CEFACT codes and plurals', () => {
    expect(normUnit('GRM')).toBe('g')
    expect(normUnit('G21')).toBe('cup')
    expect(normUnit('Tablespoons')).toBe('tbsp')
    expect(normUnit('cloves')).toBe('clove')
    expect(normUnit(undefined)).toBe('whole')
  })
  it('converts within and across dimensions', () => {
    expect(convert({ value: 1, unit: 'lb' }, 'g')).toBeCloseTo(453.59, 1)
    expect(convert({ value: 3, unit: 'tsp' }, 'tbsp')).toBeCloseTo(1, 5)
    expect(convert({ value: 1, unit: 'cup' }, 'g')).toBeNull()
    expect(toGrams({ value: 1, unit: 'cup' }, { densityGPerMl: 1 })).toBeCloseTo(236.6, 1)
    expect(toGrams({ value: 2, unit: 'clove' }, { gramsPerUnit: { clove: 3 } })).toBe(6)
  })
  it('formats friendly amounts', () => {
    expect(formatNumber(1.5)).toBe('1½')
    expect(formatNumber(0.25)).toBe('¼')
    expect(formatQty({ value: 2, unit: 'cup' })).toBe('2 cups')
    expect(formatQty({ value: 3, unit: 'whole' })).toBe('3')
    expect(humanize({ value: 1000, unit: 'g' })).toEqual({ value: 2.25, unit: 'lb' })
  })
  it('parses ISO durations', () => {
    expect(isoMinutes('PT1H20M')).toBe(80)
    expect(minutesIso(80)).toBe('PT1H20M')
    expect(minutesIso(5)).toBe('PT5M')
  })
})

describe('nutrition', () => {
  it('computes a component portion from its batch', () => {
    const c = lib.components.get('comp/chicken-sheetpan')!
    const { n, issues } = componentNutrition(lib, c)
    expect(issues).toEqual([])
    // 1000 g raw breast → 750 g cooked; 150 g portion = 200 g raw ≈ 45 g protein
    expect(n.protein).toBeCloseTo(45, 0)
    expect(n.kcal).toBeGreaterThan(240)
    expect(n.kcal).toBeLessThan(290)
  })
  it('sums combos and classifies against target', () => {
    const combo = lib.combos.get('combo/chipotle-chicken-bowl')!
    const { n } = partsNutrition(lib, combo.parts)
    expect(targetStatus(n, targets)).toBe('hit')
    expect(targetStatus({ ...n, kcal: 800 }, targets)).toBe('over')
    expect(targetStatus({ ...n, protein: 10 }, targets)).toBe('low-protein')
  })
  it('every component has complete nutrition', () => {
    for (const c of lib.components.values()) expect(componentNutrition(lib, c).issues, c.id).toEqual([])
  })
})

describe('combos', () => {
  const byId = (s: string) => lib.components.get(`comp/${s}`)!
  it('treats neutral as a wildcard and rejects clashes', () => {
    expect(sharedProfile([byId('rice-white'), byId('turkey-taco'), byId('yogurt-lime-crema')])).toEqual(['mexican'])
    expect(sharedProfile([byId('turkey-taco'), byId('tzatziki')])).toBeNull()
    expect(sharedProfile([byId('rice-white'), byId('cucumber')])).toEqual([])
  })
  it('suggests curated first and generates valid combos', () => {
    const set = new Set(lib.combos.get('combo/chipotle-chicken-bowl')!.parts.map((p) => p.componentId))
    set.add('comp/quinoa')
    set.add('comp/tortilla-high-protein')
    const { curated, generated } = suggest(lib, set, targets)
    expect(curated.map((s) => s.combo.id)).toContain('combo/chipotle-chicken-bowl')
    expect(generated.length).toBeGreaterThan(0)
    for (const s of generated) {
      const cs = s.combo.parts.map((p) => lib.components.get(p.componentId)!)
      expect(cs.filter((c) => c.role === 'base')).toHaveLength(1)
      expect(cs.some((c) => c.role === 'sauce')).toBe(true)
      expect(cs.every((c) => c.formats.includes(s.combo.format))).toBe(true)
      expect(sharedProfile(cs)).not.toBeNull()
    }
    // Ranked by distance
    const d = generated.map((s) => s.distance)
    expect([...d].sort((a, b) => a - b)).toEqual(d)
  })
  it('round-trips generated ids', () => {
    const set = new Set(['comp/rice-white', 'comp/chicken-rotisserie', 'comp/cucumber', 'comp/sesame-soy'])
    const [s] = suggest(lib, set, targets).generated
    const again = resolveCombo(lib, s.combo.id)!
    expect(again.parts).toEqual(s.combo.parts)
    expect(again.name).toBe(s.combo.name)
  })
  it('fits the base portion toward the kcal target within range', () => {
    const combo = lib.combos.get('combo/ginger-scallion-chicken-bowl')!
    const q = fitBasePortion(lib, combo, targets)!
    expect(q.unit).toBe('cup')
    expect(q.value).toBeGreaterThan(0.75)
    expect(q.value).toBeLessThanOrEqual(1)
  })
})

describe('shopping + prep', () => {
  it('scales by menu, merges foods, rounds to buy units', () => {
    const menu = [
      { comboId: 'combo/turkey-taco-wrap', servings: 3 },
      { comboId: 'combo/gochujang-turkey-bowl', servings: 3 },
      { comboId: 'combo/kofta-couscous-bowl', servings: 2 },
    ]
    const needs = componentNeeds(lib, menu)
    expect(needs.get('comp/turkey-taco')!.batches).toBeGreaterThanOrEqual(1)
    const items = shoppingList(lib, needs)
    const turkey = items.find((i) => i.foodId === 'food/ground-turkey-93')!
    expect(turkey.usedBy.length).toBe(3)
    expect(turkey.buy).toMatch(/lb/)
    const yogurt = items.find((i) => i.foodId === 'food/greek-yogurt')!
    expect(yogurt.buy).toMatch(/32 oz/)
    const plan = prepPlan(needs)
    expect(plan.tasks.some((t) => t.id === 'group/ground-turkey')).toBe(true)
    expect(plan.estimateMin).toBeGreaterThan(0)
    expect(eatOrder(needs)[0].fridgeDays).toBeLessThanOrEqual(4)
  })
  it('applies batch adjustments: override, skip, and extras', () => {
    const menu = [{ comboId: 'combo/chipotle-chicken-bowl', servings: 4 }]
    const auto = componentNeeds(lib, menu)
    const rice = auto.get('comp/rice-white')!
    expect(rice.adjusted).toBe(false)
    const needs = componentNeeds(lib, menu, { 'comp/rice-white': 2, 'comp/black-beans': 0, 'comp/eggs-jammy': 1 })
    expect(needs.get('comp/rice-white')).toMatchObject({ batches: 2, autoBatches: rice.autoBatches, adjusted: true })
    expect(needs.get('comp/black-beans')!.batches).toBe(0)
    expect(needs.get('comp/eggs-jammy')).toMatchObject({ batches: 1, servings: 0 })
    const items = shoppingList(lib, needs)
    expect(items.some((i) => i.foodId === 'food/black-beans-canned')).toBe(false)
    expect(items.find((i) => i.foodId === 'food/egg')!.buy).toMatch(/12/)
    expect(prepPlan(needs).tasks.some((t) => t.id === 'comp/black-beans')).toBe(false)
  })
})

describe('handoff', () => {
  it('base45 matches RFC 9285 vectors', () => {
    const enc = (s: string) => b45.encode(new TextEncoder().encode(s))
    expect(enc('AB')).toBe('BB8')
    expect(enc('Hello!!')).toBe('%69 VD92EX0')
    expect(enc('base-45')).toBe('UJCLQE7W581')
    expect(new TextDecoder().decode(b45.decode('QED8WEX0'))).toBe('ietf!')
  })
  it('round-trips a payload through the URL fragment', async () => {
    const p: HandoffPayload = {
      v: lib.version,
      p: ['abc123', '2026-09-29', 7, 2],
      m: [['turkey-taco-wrap', 3], ['gen/bowl/rice-white+chicken-rotisserie+cucumber+sesame-soy', 2, [['rice-white', 1, 'cup']]]],
      a: [['eggs-jammy', 1]],
      s: [['produce', [['cucumber', '2'], ['limes', '3']]]],
    }
    const frag = await encodePayload(p)
    expect(frag).not.toMatch(/ /)
    expect(readFragment('#p=' + frag)).toBe(frag)
    expect(await decodePayload(frag)).toEqual(p)
  })
})

describe('periods', () => {
  it('computes ranges, next period and status', () => {
    const p = { id: 'x', start: '2026-09-28', days: 4, mealsPerDay: 2 }
    expect(mealsTarget(p)).toBe(8)
    expect(endDate(p)).toBe('2026-10-01')
    expect(periodStatus(p, '2026-09-29')).toEqual({ state: 'current', day: 2 })
    expect(periodStatus(p, '2026-10-02').state).toBe('past')
    expect(periodStatus(p, '2026-09-27').state).toBe('upcoming')
    expect(nextPeriod(p).days).toBe(4)
    expect(nextPeriod(p).id).not.toBe('x')
  })
  it('distributes starter plan servings to fill the period', () => {
    expect(distribute([['a', 1], ['b', 1]], 7)).toEqual([['a', 4], ['b', 3]])
    expect(distribute([['a', 1], ['b', 1], ['c', 1]], 2).map(([, n]) => n)).toEqual([1, 1, 1])
    for (const s of STARTER_PLANS) for (const [id] of s.combos) expect(lib.combos.has(id), id).toBe(true)
  })
})
