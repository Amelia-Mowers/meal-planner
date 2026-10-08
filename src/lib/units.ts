/** Unit normalization and conversion. Shared by the app and the build/validate scripts. */

export type Dim = 'mass' | 'volume' | 'count'
export interface Qty {
  value: number
  unit: string
}
export interface QuantitativeValue {
  '@type'?: 'QuantitativeValue'
  value: number
  unitCode?: string
  unitText?: string
}

const MASS_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 }
const VOL_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  floz: 29.5735295625,
  cup: 236.5882365,
}

/** UN/CEFACT Recommendation 20 codes. */
const CODE_TO_UNIT: Record<string, string> = {
  GRM: 'g',
  KGM: 'kg',
  ONZ: 'oz',
  LBR: 'lb',
  MLT: 'ml',
  LTR: 'l',
  G21: 'cup',
  G24: 'tbsp',
  G25: 'tsp',
  OZA: 'floz',
}
const UNIT_TO_CODE = Object.fromEntries(Object.entries(CODE_TO_UNIT).map(([c, u]) => [u, c]))

const ALIASES: Record<string, string> = {
  gram: 'g', grams: 'g', gr: 'g',
  kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
  ounce: 'oz', ounces: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
  cups: 'cup', c: 'cup',
  'fl oz': 'floz', 'fluid ounce': 'floz', 'fluid ounces': 'floz',
  '': 'whole', each: 'whole', piece: 'whole', pieces: 'whole', item: 'whole', items: 'whole',
  cloves: 'clove', cans: 'can', bags: 'bag', jars: 'jar', bunches: 'bunch', heads: 'head',
  blocks: 'block', bottles: 'bottle', boxes: 'box', tubs: 'tub', packages: 'package', pkg: 'package',
  dozen: 'dozen',
  servings: 'serving', portion: 'serving', portions: 'serving',
  scoops: 'scoop', cartons: 'carton', quarts: 'quart',
}

export function normUnit(u: string | undefined | null): string {
  const s = (u ?? '').trim().toLowerCase()
  if (CODE_TO_UNIT[s.toUpperCase()]) return CODE_TO_UNIT[s.toUpperCase()]
  return ALIASES[s] ?? s
}

export function dimOf(unit: string): Dim {
  if (unit in MASS_G) return 'mass'
  if (unit in VOL_ML) return 'volume'
  return 'count'
}

export function fromQV(qv: QuantitativeValue | undefined | null): Qty | null {
  if (!qv || typeof qv.value !== 'number') return null
  return { value: qv.value, unit: normUnit(qv.unitCode ?? qv.unitText) }
}

export function toQV(q: Qty): QuantitativeValue {
  const code = UNIT_TO_CODE[q.unit]
  return code
    ? { '@type': 'QuantitativeValue', value: q.value, unitCode: code }
    : { '@type': 'QuantitativeValue', value: q.value, unitText: q.unit }
}

export interface FoodUnits {
  densityGPerMl?: number | null
  gramsPerUnit?: Record<string, number>
}

/** Convert a quantity of a food to grams, or null if not enough information. */
export function toGrams(q: Qty, food?: FoodUnits | null): number | null {
  const d = dimOf(q.unit)
  if (d === 'mass') return q.value * MASS_G[q.unit]
  if (d === 'volume') return food?.densityGPerMl ? q.value * VOL_ML[q.unit] * food.densityGPerMl : null
  if (q.unit === 'dozen') return food?.gramsPerUnit?.whole ? q.value * 12 * food.gramsPerUnit.whole : null
  const g = food?.gramsPerUnit?.[q.unit]
  return g ? q.value * g : null
}

/** Convert q into `unit`. Same dimension always works; mass↔volume needs density; counts need gramsPerUnit. */
export function convert(q: Qty, unit: string, food?: FoodUnits | null): number | null {
  if (q.unit === unit) return q.value
  const from = dimOf(q.unit)
  const to = dimOf(unit)
  if (from === to && from === 'mass') return (q.value * MASS_G[q.unit]) / MASS_G[unit]
  if (from === to && from === 'volume') return (q.value * VOL_ML[q.unit]) / VOL_ML[unit]
  const grams = toGrams(q, food)
  if (grams == null) return null
  const one = toGrams({ value: 1, unit }, food)
  return one ? grams / one : null
}

/** Ratio q / base, when both are expressible in the same unit. */
export function ratio(q: Qty, base: Qty, food?: FoodUnits | null): number | null {
  const v = convert(q, base.unit, food)
  return v == null || base.value === 0 ? null : v / base.value
}

// ───────────── Formatting ─────────────

const FRACTIONS: [number, string][] = [
  [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾'],
]

export function formatNumber(n: number, allowFractions = true): string {
  if (!isFinite(n)) return '–'
  const whole = Math.floor(n + 1e-9)
  const frac = n - whole
  if (allowFractions && frac > 0.01) {
    for (const [v, s] of FRACTIONS) if (Math.abs(frac - v) < 0.04) return (whole ? String(whole) : '') + s
    if (frac > 0.96) return String(whole + 1)
  }
  if (n >= 100) return String(Math.round(n))
  if (n >= 10) return String(Math.round(n * 2) / 2).replace(/\.0$/, '')
  return String(Math.round(n * 10) / 10)
}

const LABEL: Record<string, [string, string]> = {
  g: ['g', 'g'], kg: ['kg', 'kg'], oz: ['oz', 'oz'], lb: ['lb', 'lb'],
  ml: ['ml', 'ml'], l: ['L', 'L'], tsp: ['tsp', 'tsp'], tbsp: ['tbsp', 'tbsp'],
  cup: ['cup', 'cups'], floz: ['fl oz', 'fl oz'], whole: ['', ''],
  clove: ['clove', 'cloves'], can: ['can', 'cans'], bag: ['bag', 'bags'], jar: ['jar', 'jars'],
  bunch: ['bunch', 'bunches'], head: ['head', 'heads'], block: ['block', 'blocks'],
  bottle: ['bottle', 'bottles'], box: ['box', 'boxes'], tub: ['tub', 'tubs'],
  package: ['package', 'packages'], dozen: ['dozen', 'dozen'],
  serving: ['serving', 'servings'], scoop: ['scoop', 'scoops'], carton: ['carton', 'cartons'], quart: ['quart', 'quarts'],
}

export function unitLabel(unit: string, value = 1): string {
  const l = LABEL[unit]
  if (!l) return unit
  return value > 1 + 1e-9 ? l[1] : l[0]
}

export function formatQty(q: Qty): string {
  const metricish = q.unit === 'g' || q.unit === 'ml'
  const num = formatNumber(q.value, !metricish)
  const label = unitLabel(q.unit, q.value)
  return label ? `${num} ${label}` : num
}

/** Pick a friendly display unit for a total amount in a given dimension (US-style). */
export function humanize(q: Qty): Qty {
  const d = dimOf(q.unit)
  if (d === 'mass') {
    const g = q.value * MASS_G[q.unit]
    if (g >= 453.59237 * 0.75) return { value: roundTo(g / 453.59237, 0.25), unit: 'lb' }
    if (g >= 14) return { value: roundTo(g / 28.349523125, 0.5), unit: 'oz' }
    return { value: Math.round(g), unit: 'g' }
  }
  if (d === 'volume') {
    const ml = q.value * VOL_ML[q.unit]
    if (ml >= VOL_ML.cup / 4 - 0.5) return { value: roundTo(ml / VOL_ML.cup, 0.25), unit: 'cup' }
    if (ml >= VOL_ML.tbsp - 0.5) return { value: roundTo(ml / VOL_ML.tbsp, 0.5), unit: 'tbsp' }
    return { value: roundTo(ml / VOL_ML.tsp, 0.25), unit: 'tsp' }
  }
  return q
}

export function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step)
}

export function formatIngredient(q: Qty, name: string, description?: string): string {
  const amt = formatQty(q)
  return `${amt} ${name}${description ? `, ${description}` : ''}`
}
