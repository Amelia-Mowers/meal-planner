import { db } from './db'
import { MP_CONTEXT } from './library'
import { app } from './store.svelte'
import type { Food, LibraryFile, RecipeDoc } from './types'

const STATE_KEYS = ['period', 'menu', 'adjust', 'portions', 'have', 'inCart', 'prepDone', 'history', 'targets', 'tested'] as const

export function exportAll() {
  const state = Object.fromEntries(STATE_KEYS.map((k) => [k, $state.snapshot(app[k])]))
  return {
    app: 'meal-planner',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    libraryVersion: app.lib.version,
    state,
    private: { '@context': MP_CONTEXT, '@graph': app.privateDocs, foods: app.privateFoods },
  }
}

export function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function readJsonFile(file: File): Promise<unknown> {
  return JSON.parse(await file.text())
}

export async function importBackup(data: unknown) {
  const d = data as ReturnType<typeof exportAll>
  if (!d || d.app !== 'meal-planner' || !d.state) throw new Error("This doesn't look like a Meal Planner backup.")
  for (const k of STATE_KEYS) if (k in d.state) (app as unknown as Record<string, unknown>)[k] = d.state[k]
  if (d.private) await replacePrivate(d.private as LibraryFile)
}

function checkLibrary(data: unknown): LibraryFile {
  const f = data as LibraryFile
  if (!f || !Array.isArray(f['@graph'])) throw new Error('Expected a JSON-LD file with an "@graph" array of recipes.')
  const bad = f['@graph'].filter((d) => d?.['@type'] !== 'Recipe' || typeof d['@id'] !== 'string')
  if (bad.length) throw new Error(`${bad.length} entries aren't schema.org Recipes with an @id.`)
  return f
}

/** Merge a private library (e.g. private-library.json from the cookbook pipeline) into IndexedDB. */
export async function importPrivate(data: unknown): Promise<{ recipes: number; foods: number; warnings: string[] }> {
  const f = checkLibrary(data)
  const foods = (f.foods ?? []) as Food[]
  await db.transaction('rw', db.privateDocs, db.privateFoods, async () => {
    await db.privateDocs.bulkPut(f['@graph'].map((doc: RecipeDoc) => ({ id: doc['@id'], doc })))
    if (foods.length) await db.privateFoods.bulkPut(foods)
  })
  await app.loadPrivate()
  const warnings: string[] = []
  for (const doc of f['@graph']) {
    for (const s of doc.supply ?? []) {
      const known = s.identifier.startsWith('food/') ? app.lib.foods.has(s.identifier) : app.lib.components.has(s.identifier)
      if (!known) warnings.push(`${doc.name}: unknown ${s.identifier}`)
    }
  }
  return { recipes: f['@graph'].length, foods: foods.length, warnings }
}

async function replacePrivate(f: LibraryFile) {
  await db.transaction('rw', db.privateDocs, db.privateFoods, async () => {
    await db.privateDocs.clear()
    await db.privateFoods.clear()
  })
  if (f['@graph']?.length || f.foods?.length) await importPrivate(f)
  else await app.loadPrivate()
}

export async function clearPrivate() {
  await replacePrivate({ '@context': MP_CONTEXT, '@graph': [] })
}
