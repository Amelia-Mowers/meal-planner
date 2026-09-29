import foodsJson from '../data/foods.json'
import libraryRaw from '../data/library.jsonld?raw'
import { db, getKV, requestPersistence, setKV } from './db'
import { buildLibrary } from './library'
import { componentNeeds, shoppingList } from './shopping'
import type { Food, Format, Library, LibraryFile, MenuItem, RecipeDoc, Targets } from './types'
import type { Qty } from './units'

const bundled = JSON.parse(libraryRaw) as LibraryFile
const bundledFoods = foodsJson.foods as Food[]

export const DEFAULT_TARGETS: Targets = { kcal: 600, protein: 40, tolerance: 0.1 }

/** Persisted keys and their defaults. */
const DEFAULTS = {
  prepSet: [] as string[],
  menu: [] as MenuItem[],
  have: null as string[] | null, // null = not initialized yet (seed with pantry staples)
  inCart: [] as string[],
  prepDone: [] as string[],
  targets: DEFAULT_TARGETS,
  mealsPerWeek: 10,
  tested: {} as Record<string, boolean>,
  portions: {} as Record<string, Record<string, Qty>>,
  onlyTested: false,
  format: 'all' as Format | 'all',
  onboarded: false,
}
type Persisted = typeof DEFAULTS

class AppState {
  ready = $state(false)
  prepSet = $state<string[]>([])
  menu = $state<MenuItem[]>([])
  have = $state<string[]>([])
  inCart = $state<string[]>([])
  prepDone = $state<string[]>([])
  targets = $state<Targets>(DEFAULT_TARGETS)
  mealsPerWeek = $state(10)
  tested = $state<Record<string, boolean>>({})
  /** Portion overrides per combo, from the portion slider. */
  portions = $state<Record<string, Record<string, Qty>>>({})
  onlyTested = $state(false)
  format = $state<Format | 'all'>('all')
  onboarded = $state(false)
  privateDocs = $state.raw<RecipeDoc[]>([])
  privateFoods = $state.raw<Food[]>([])
  persisted = $state<boolean | null>(null)

  lib: Library = $derived(buildLibrary(bundledFoods, bundled, this.privateDocs, this.privateFoods))
  prepSetIds = $derived(new Set(this.prepSet))
  menuCount = $derived(this.menu.reduce((s, m) => s + m.servings, 0))
  menuWithPortions: MenuItem[] = $derived(this.menu.map((m) => ({ ...m, portions: this.portions[m.comboId] })))
  needs = $derived(componentNeeds(this.lib, this.menuWithPortions, this.prepSet))
  shopping = $derived(shoppingList(this.lib, this.needs))

  isTested = (id: string) => this.tested[id] ?? this.lib.components.get(id)?.tested ?? this.lib.combos.get(id)?.tested ?? false

  toggleInSet(id: string) {
    this.prepSet = this.prepSetIds.has(id) ? this.prepSet.filter((x) => x !== id) : [...this.prepSet, id]
  }
  servingsOf(comboId: string) {
    return this.menu.find((m) => m.comboId === comboId)?.servings ?? 0
  }
  setServings(comboId: string, servings: number) {
    const n = Math.max(0, Math.min(21, Math.round(servings)))
    const i = this.menu.findIndex((m) => m.comboId === comboId)
    if (n === 0) this.menu = this.menu.filter((m) => m.comboId !== comboId)
    else if (i === -1) this.menu = [...this.menu, { comboId, servings: n }]
    else this.menu = this.menu.map((m, j) => (j === i ? { ...m, servings: n } : m))
  }
  setPortion(comboId: string, componentId: string, qty: Qty | null) {
    const cur = { ...(this.portions[comboId] ?? {}) }
    if (qty) cur[componentId] = qty
    else delete cur[componentId]
    this.portions = { ...this.portions, [comboId]: cur }
  }
  toggle(list: 'have' | 'inCart' | 'prepDone', id: string) {
    const arr = this[list]
    this[list] = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  }

  async init() {
    const entries = await Promise.all(
      (Object.keys(DEFAULTS) as (keyof Persisted)[]).map(async (k) => [k, await getKV(k, DEFAULTS[k])] as const),
    )
    const s = Object.fromEntries(entries) as Persisted
    this.prepSet = s.prepSet
    this.menu = s.menu
    this.have = s.have ?? bundledFoods.filter((f) => f.pantry).map((f) => f.id)
    this.inCart = s.inCart
    this.prepDone = s.prepDone
    this.targets = { ...DEFAULT_TARGETS, ...s.targets }
    this.mealsPerWeek = s.mealsPerWeek
    this.tested = s.tested
    this.portions = s.portions
    this.onlyTested = s.onlyTested
    this.format = s.format
    this.onboarded = s.onboarded
    await this.loadPrivate()
    this.ready = true
    this.persisted = await requestPersistence().catch(() => null)

    // Persist each key whenever it changes.
    $effect.root(() => {
      for (const k of Object.keys(DEFAULTS) as (keyof Persisted)[]) {
        $effect(() => {
          const v = $state.snapshot(this[k])
          setKV(k, v)
        })
      }
    })
  }

  async loadPrivate() {
    this.privateDocs = (await db.privateDocs.toArray()).map((r) => r.doc)
    this.privateFoods = await db.privateFoods.toArray()
  }
}

export const app = new AppState()
