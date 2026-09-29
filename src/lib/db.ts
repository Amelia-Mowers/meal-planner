import Dexie, { type EntityTable } from 'dexie'
import type { Food, RecipeDoc } from './types'

interface KV {
  key: string
  value: unknown
}
interface PrivateDoc {
  id: string
  doc: RecipeDoc
}

/** IndexedDB (never localStorage): app state + the private recipe overlay. */
class MealDB extends Dexie {
  kv!: EntityTable<KV, 'key'>
  privateDocs!: EntityTable<PrivateDoc, 'id'>
  privateFoods!: EntityTable<Food, 'id'>
  constructor() {
    super('meal-planner')
    this.version(1).stores({ kv: 'key', privateDocs: 'id', privateFoods: 'id' })
  }
}

export const db = new MealDB()

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key)
  return row === undefined ? fallback : (row.value as T)
}

export function setKV(key: string, value: unknown) {
  return db.kv.put({ key, value })
}

/** Ask the browser not to evict our data. Returns whether storage is persistent. */
export async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function storageStatus(): Promise<{ persisted: boolean | null; usage?: number; quota?: number }> {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : {}
  return { persisted, usage: est.usage, quota: est.quota }
}
