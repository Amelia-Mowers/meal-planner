/**
 * Builds src/data/foods.json from data/foods.source.json + USDA FoodData Central (SR Legacy CSV).
 *
 *   npm run build:foods              # downloads the SR Legacy CSV zip into .cache/ if missing
 *   FDC_DIR=/path/to/csv npm run build:foods
 *
 * Nutrition is never hand-typed for foods that have an fdcId: it is read from the USDA dataset.
 * Volume density is derived from USDA cup/tbsp/tsp portion weights unless the source overrides it.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SR_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip'

const NUTRIENTS: Record<string, 'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber'> = {
  '1008': 'kcal',
  '1003': 'protein',
  '1004': 'fat',
  '1005': 'carbs',
  '1079': 'fiber',
}
const ML = { cup: 236.588, tbsp: 14.787, tsp: 4.929 }

function locateCsvDir(): string {
  if (process.env.FDC_DIR) return process.env.FDC_DIR
  const cache = join(ROOT, '.cache')
  const find = () => {
    if (!existsSync(cache)) return null
    const d = readdirSync(cache).find((n) => n.startsWith('FoodData_Central_sr_legacy'))
    return d && !d.endsWith('.zip') ? join(cache, d) : null
  }
  const found = find()
  if (found) return found
  mkdirSync(cache, { recursive: true })
  const zip = join(cache, 'sr_legacy.zip')
  console.log('Downloading USDA SR Legacy…')
  execFileSync('curl', ['-sSL', '-o', zip, SR_URL], { stdio: 'inherit' })
  execFileSync('unzip', ['-o', '-q', zip, '-d', cache], { stdio: 'inherit' })
  const after = find()
  if (!after) throw new Error('Could not find SR Legacy CSV directory after unzip')
  return after
}

/** Minimal RFC-4180 line parser (SR Legacy has no embedded newlines). */
function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') out.push(cur), (cur = '')
    else cur += c
  }
  out.push(cur)
  return out
}

function* rows(file: string) {
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 1; i < lines.length; i++) if (lines[i]) yield parseLine(lines[i].replace(/\r$/, ''))
}

type SourceFood = {
  id: string
  fdcId: number | null
  per100g?: Record<string, number>
  densityGPerMl?: number | null
  [k: string]: unknown
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

function main() {
  const src = JSON.parse(readFileSync(join(ROOT, 'data/foods.source.json'), 'utf8')) as { foods: SourceFood[] }
  const dir = locateCsvDir()
  const wanted = new Set(src.foods.filter((f) => f.fdcId).map((f) => String(f.fdcId)))

  const desc = new Map<string, string>()
  for (const r of rows(join(dir, 'food.csv'))) if (wanted.has(r[0])) desc.set(r[0], r[2])

  const nutr = new Map<string, Record<string, number>>()
  for (const r of rows(join(dir, 'food_nutrient.csv'))) {
    const key = NUTRIENTS[r[2]]
    if (!key || !wanted.has(r[1])) continue
    const m = nutr.get(r[1]) ?? {}
    m[key] = Number(r[3])
    nutr.set(r[1], m)
  }

  // Density from volume portions: prefer cup, then tbsp, then tsp.
  const density = new Map<string, { rank: number; g: number }>()
  for (const r of rows(join(dir, 'food_portion.csv'))) {
    const fdc = r[1]
    if (!wanted.has(fdc)) continue
    const amount = Number(r[3]) || 1
    const unitId = r[4]
    const mod = (r[6] || '').toLowerCase()
    const grams = Number(r[7])
    let ml: number | null = null
    let rank = 9
    if (unitId === '1000' || /^cups?\b/.test(mod)) (ml = ML.cup), (rank = 0)
    else if (unitId === '1001' || /^(tbsp|tablespoons?)\b/.test(mod)) (ml = ML.tbsp), (rank = 1)
    else if (unitId === '1002' || /^(tsp|teaspoons?)\b/.test(mod)) (ml = ML.tsp), (rank = 2)
    if (ml == null || !grams) continue
    const g = grams / (amount * ml)
    const prev = density.get(fdc)
    if (!prev || rank < prev.rank) density.set(fdc, { rank, g })
  }

  const missing: string[] = []
  const foods = src.foods.map((f) => {
    const out: Record<string, unknown> = { ...f }
    if (f.fdcId) {
      const k = String(f.fdcId)
      const n = nutr.get(k)
      if (!n || n.kcal == null) {
        missing.push(`${f.id} (fdcId ${k})`)
        return out
      }
      out.per100g = {
        kcal: round(n.kcal, 0),
        protein: round(n.protein ?? 0),
        fat: round(n.fat ?? 0),
        carbs: round(n.carbs ?? 0),
        fiber: round(n.fiber ?? 0),
      }
      out.nutritionSource = 'usda-sr-legacy'
      out.fdcDescription = desc.get(k)
      if (f.densityGPerMl === undefined) out.densityGPerMl = density.has(k) ? round(density.get(k)!.g, 3) : null
    } else if (f.densityGPerMl === undefined) out.densityGPerMl = null
    return out
  })
  if (missing.length) {
    console.error('Missing USDA data for:\n  ' + missing.join('\n  '))
    process.exit(1)
  }
  const outFile = join(ROOT, 'src/data/foods.json')
  mkdirSync(join(ROOT, 'src/data'), { recursive: true })
  writeFileSync(outFile, JSON.stringify({ source: SR_URL, foods }, null, 2) + '\n')
  console.log(`Wrote ${foods.length} foods to src/data/foods.json`)
}

main()
