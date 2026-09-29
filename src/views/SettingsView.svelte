<script lang="ts">
  import { Database, Download, FileUp, HardDrive, Lock, Target, Trash2, Upload } from '@lucide/svelte'
  import { clearPrivate, download, exportAll, importBackup, importPrivate, readJsonFile } from '../lib/backup.svelte'
  import { requestPersistence, storageStatus } from '../lib/db'
  import { plural } from '../lib/format'
  import { app, DEFAULT_TARGETS } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'

  let storage = $state<Awaited<ReturnType<typeof storageStatus>> | null>(null)
  let importMsg = $state('')
  let importWarnings = $state<string[]>([])
  $effect(() => {
    storageStatus().then((s) => (storage = s))
  })

  const privateRecipes = $derived(app.privateDocs.length)
  const mb = (n?: number) => (n == null ? '?' : n < 1e6 ? `${Math.round(n / 1e3)} KB` : `${(n / 1e6).toFixed(1)} MB`)

  async function onBackup(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      await importBackup(await readJsonFile(file))
      toasts.show('Backup restored')
    } catch (err) {
      toasts.show(err instanceof Error ? err.message : 'Import failed')
    }
    ;(e.currentTarget as HTMLInputElement).value = ''
  }
  async function onPrivate(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const r = await importPrivate(await readJsonFile(file))
      importMsg = `Imported ${plural(r.recipes, 'recipe')}${r.foods ? ` and ${plural(r.foods, 'food')}` : ''}.`
      importWarnings = r.warnings
      toasts.show(importMsg)
    } catch (err) {
      importMsg = err instanceof Error ? err.message : 'Import failed'
      importWarnings = []
    }
    input.value = ''
  }
  async function removePrivate() {
    if (!confirm(`Remove all ${privateRecipes} private recipes from this device? Export a backup first if you need them.`)) return
    await clearPrivate()
    toasts.show('Private recipes removed')
  }
  async function persist() {
    app.persisted = await requestPersistence()
    storage = await storageStatus()
    toasts.show(app.persisted ? 'Storage is now persistent' : 'The browser declined — install the app to improve the odds')
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Settings</h1>
      <p class="lede">Targets, data and backups. Everything is stored on this device only.</p>
    </div>
  </div>

  <section class="card pad stack">
    <h2 class="row"><Target size={18} /> Nutrition target per meal</h2>
    <div class="grid">
      <div class="field">
        <label for="kcal">Calories</label>
        <div class="unit"><input id="kcal" class="input num" type="number" min="200" max="2000" step="10" bind:value={app.targets.kcal} /><span>kcal</span></div>
      </div>
      <div class="field">
        <label for="protein">Protein, at least</label>
        <div class="unit"><input id="protein" class="input num" type="number" min="0" max="200" step="1" bind:value={app.targets.protein} /><span>g</span></div>
      </div>
      <div class="field">
        <label for="tol">Calorie tolerance · ±{Math.round(app.targets.tolerance * 100)}%</label>
        <input id="tol" type="range" min="0.05" max="0.25" step="0.01" bind:value={app.targets.tolerance} />
      </div>
      <div class="field">
        <label for="meals">Meals to plan per week</label>
        <div class="unit"><input id="meals" class="input num" type="number" min="1" max="21" bind:value={app.mealsPerWeek} /><span>meals</span></div>
      </div>
    </div>
    <p class="small muted">
      A combo is <strong>on target</strong> when it's within ±{Math.round(app.targets.tolerance * 100)}% of {app.targets.kcal} kcal and has at least
      {app.targets.protein} g protein.
      {#if app.targets.kcal !== DEFAULT_TARGETS.kcal || app.targets.protein !== DEFAULT_TARGETS.protein}
        <button class="btn sm ghost" onclick={() => (app.targets = { ...DEFAULT_TARGETS })}>Reset to 600 kcal / 40 g</button>
      {/if}
    </p>
  </section>

  <section class="card pad stack">
    <h2 class="row"><Lock size={18} /> Private recipes</h2>
    <p class="small muted">
      Import <code>third-party/private-library.json</code> — cookbook conversions done by hand in Claude Code (see <code>third-party/README.md</code>). Private recipes stay in this browser's IndexedDB and are
      never uploaded or deployed.
    </p>
    <div class="row wrap">
      <label class="btn primary">
        <FileUp size={16} /> Import private library
        <input type="file" accept="application/json,.json,.jsonld" class="sr-only" onchange={onPrivate} />
      </label>
      {#if privateRecipes}
        <span class="badge accent">{plural(privateRecipes, 'private recipe')}</span>
        <button class="btn ghost danger" onclick={removePrivate}><Trash2 size={16} /> Remove</button>
      {/if}
    </div>
    {#if importMsg}<p class="small">{importMsg}</p>{/if}
    {#if importWarnings.length}
      <details class="small">
        <summary>{plural(importWarnings.length, 'unresolved reference')} — nutrition for these will be incomplete</summary>
        <ul>{#each importWarnings.slice(0, 50) as w (w)}<li>{w}</li>{/each}</ul>
      </details>
    {/if}
  </section>

  <section class="card pad stack">
    <h2 class="row"><Database size={18} /> Backup & sync</h2>
    <p class="small muted">Export everything (prep set, week, checklists, tested flags, private recipes) as one JSON file. Import it on another device to sync manually.</p>
    <div class="row wrap">
      <button class="btn" onclick={() => download(`meal-planner-backup-${new Date().toISOString().slice(0, 10)}.json`, exportAll())}>
        <Download size={16} /> Export backup
      </button>
      <label class="btn">
        <Upload size={16} /> Restore backup
        <input type="file" accept="application/json,.json" class="sr-only" onchange={onBackup} />
      </label>
    </div>
  </section>

  <section class="card pad stack">
    <h2 class="row"><HardDrive size={18} /> Storage</h2>
    <p class="small">
      {#if storage?.persisted}
        <span class="badge ok">Persistent</span> The browser won't clear your data to free space.
      {:else if storage?.persisted === false}
        <span class="badge warn">Best-effort</span> The browser may clear data under storage pressure.
        <button class="btn sm" onclick={persist}>Request persistent storage</button>
      {:else}
        <span class="badge">Unknown</span> This browser doesn't report storage persistence.
      {/if}
    </p>
    {#if storage?.usage != null}<p class="small muted">Using {mb(storage.usage)} of {mb(storage.quota)} available.</p>{/if}
  </section>

  <section class="small muted about">
    <p>
      Nutrition: <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> (SR Legacy), public domain. A few
      items without a USDA match use typical label values and are marked ≈.
    </p>
    <p>
      Starter library: AI-generated, dedicated to the public domain under
      <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0</a>. Recipes use schema.org JSON-LD, so
      they import into Tandoor or Mealie.
    </p>
    <p>Library version <code>{app.lib.version}</code></p>
  </section>
</div>

<style>
  .pad {
    padding: 1.1rem 1.2rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  .unit {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .unit span {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .unit .input {
    max-width: 140px;
  }
  code {
    font-family: var(--mono);
    font-size: 0.85em;
    background: var(--surface-2);
    padding: 0.1rem 0.35rem;
    border-radius: 6px;
  }
  label.btn {
    cursor: pointer;
  }
  label.btn:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .about {
    display: grid;
    gap: 0.4rem;
    padding: 0 0.25rem;
  }
</style>
