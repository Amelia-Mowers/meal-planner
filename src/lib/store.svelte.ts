import foodsJson from '../data/foods.json'
import libraryRaw from '../data/library.jsonld?raw'
import { db, getKV, requestPersistence, setKV } from './db'
import { buildLibrary } from './library'
import { newPeriod, nextPeriod, type Period } from './period'
import { componentNeeds, shoppingList } from './shopping'
import { distribute, type StarterPlan } from './starterSets'
import type { Food, Library, LibraryFile, MenuItem, RecipeDoc, Targets } from './types'
import type { Qty } from './units'

const bundled = JSON.parse(libraryRaw) as LibraryFile
const bundledFoods = foodsJson.foods as Food[]

export const DEFAULT_TARGETS: Targets = { kcal: 600, protein: 40, tolerance: 0.1 }

/** A finished (archived) period, kept so it can be repeated later. */
export interface PastPeriod {
  period: Period
  menu: MenuItem[]
  adjust: Record<string, number>
  portions: Record<string, Record<string, Qty>>
}

/** Persisted keys and their defaults. */
const DEFAULTS = {
  period: null as Period | null,
  menu: [] as MenuItem[],
  /** Per-component batch counts set by hand (0 = skip). */
  adjust: {} as Record<string, number>,
  /** Portion overrides per combo, from the portion slider. */
  portions: {} as Record<string, Record<string, Qty>>,
  have: null as string[] | null, // null = not initialized yet (seed with pantry staples)
  inCart: [] as string[],
  prepDone: [] as string[],
  history: [] as PastPeriod[],
  targets: DEFAULT_TARGETS,
  tested: {} as Record<string, boolean>,
  onlyTested: false,
}
type Persisted = typeof DEFAULTS

const MAX_HISTORY = 12

class AppState {
  ready = $state(false)
  period = $state<Period | null>(null)
  menu = $state<MenuItem[]>([])
  adjust = $state<Record<string, number>>({})
  portions = $state<Record<string, Record<string, Qty>>>({})
  have = $state<string[]>([])
  inCart = $state<string[]>([])
  prepDone = $state<string[]>([])
  history = $state<PastPeriod[]>([])
  targets = $state<Targets>(DEFAULT_TARGETS)
  tested = $state<Record<string, boolean>>({})
  onlyTested = $state(false)
  privateDocs = $state.raw<RecipeDoc[]>([])
  privateFoods = $state.raw<Food[]>([])
  persisted = $state<boolean | null>(null)

  lib: Library = $derived(buildLibrary(bundledFoods, bundled, this.privateDocs, this.privateFoods))
  menuCount = $derived(this.menu.reduce((s, m) => s + m.servings, 0))
  menuWithPortions: MenuItem[] = $derived(this.menu.map((m) => ({ ...m, portions: this.portions[m.comboId] })))
  /** The prep set: components × batches, derived from the menu plus adjustments. */
  needs = $derived(componentNeeds(this.lib, this.menuWithPortions, this.adjust))
  /** Components being made this period (batches > 0). */
  prepSetIds = $derived(new Set([...this.needs.values()].filter((n) => n.batches > 0).map((n) => n.component.id)))
  shopping = $derived(shoppingList(this.lib, this.needs))

  isTested = (id: string) => this.tested[id] ?? this.lib.components.get(id)?.tested ?? this.lib.combos.get(id)?.tested ?? false

  servingsOf(comboId: string) {
    return this.menu.find((m) => m.comboId === comboId)?.servings ?? 0
  }
  setServings(comboId: string, servings: number) {
    const n = Math.max(0, Math.min(42, Math.round(servings)))
    // Adding a combo before planning a period starts a default week.
    if (n > 0 && !this.period) this.period = newPeriod()
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
  /** Set batches by hand, or null to go back to the automatic amount. */
  setBatches(componentId: string, batches: number | null) {
    const next = { ...this.adjust }
    if (batches == null) delete next[componentId]
    else next[componentId] = batches
    this.adjust = next
  }
  toggle(list: 'have' | 'inCart' | 'prepDone', id: string) {
    const arr = this[list]
    this[list] = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  }

  /** Add a starter plan's combos, spread over the meals still unplanned. */
  applyStarter(plan: StarterPlan) {
    if (!this.period) this.period = newPeriod()
    const target = this.period ? this.period.days * this.period.mealsPerDay : 7
    const remaining = Math.max(plan.combos.length, target - this.menuCount)
    for (const [id, n] of distribute(plan.combos, remaining)) this.setServings(id, this.servingsOf(id) + n)
  }

  snapshot(): PastPeriod | null {
    if (!this.period) return null
    return {
      period: $state.snapshot(this.period),
      menu: $state.snapshot(this.menu),
      adjust: $state.snapshot(this.adjust),
      portions: $state.snapshot(this.portions),
    }
  }

  /**
   * Archive the current period and start a new one. `from` pre-fills the new period's plan
   * (repeat this period, or a past one); otherwise it starts empty.
   */
  startPeriod(period: Period, from?: PastPeriod | null) {
    const snap = this.snapshot()
    if (snap && (snap.menu.length || Object.keys(snap.adjust).length))
      this.history = [snap, ...this.history.filter((h) => h.period.id !== snap.period.id)].slice(0, MAX_HISTORY)
    this.period = period
    this.menu = from ? $state.snapshot(from.menu) : []
    this.adjust = from ? $state.snapshot(from.adjust) : {}
    this.portions = from ? $state.snapshot(from.portions) : {}
    this.inCart = []
    this.prepDone = []
  }

  nextPeriodDraft(): Period {
    return this.period ? nextPeriod(this.period) : newPeriod()
  }

  async init() {
    const entries = await Promise.all(
      (Object.keys(DEFAULTS) as (keyof Persisted)[]).map(async (k) => [k, await getKV(k, DEFAULTS[k])] as const),
    )
    const s = Object.fromEntries(entries) as Persisted
    this.period = s.period
    this.menu = s.menu
    this.adjust = s.adjust
    this.portions = s.portions
    this.have = s.have ?? bundledFoods.filter((f) => f.pantry).map((f) => f.id)
    this.inCart = s.inCart
    this.prepDone = s.prepDone
    this.history = s.history
    this.targets = { ...DEFAULT_TARGETS, ...s.targets }
    this.tested = s.tested
    this.onlyTested = s.onlyTested
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
