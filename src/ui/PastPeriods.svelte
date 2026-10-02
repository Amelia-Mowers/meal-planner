<script lang="ts">
  import { ChevronDown, History, Repeat, RotateCcw, Trash2 } from '@lucide/svelte'
  import { resolveCombo } from '../lib/combos'
  import { plural } from '../lib/format'
  import { periodTitle, rangeLabel, servingWord } from '../lib/period'
  import { app, type PastPeriod } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'

  let open = $state(false)
  const past = $derived(app.history.filter((h) => h.period.id !== app.period?.id))
  const servings = (h: PastPeriod) => h.menu.reduce((s, m) => s + m.servings, 0)

  function undoable(msg: string, change: () => void) {
    const before = app.snapshot()
    const hist = $state.snapshot(app.history)
    change()
    toasts.show(msg, {
      action: () => {
        if (before) app.restorePeriod(before)
        app.history = hist
      },
    })
  }
  function restore(h: PastPeriod) {
    undoable(`Restored ${periodTitle(h.period)}`, () => app.restorePeriod(h))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function repeat(h: PastPeriod) {
    undoable(`Started a new period from ${periodTitle(h.period)}`, () => app.repeatPeriod(h))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function remove(h: PastPeriod) {
    const hist = $state.snapshot(app.history)
    app.deletePast(h.period.id)
    toasts.show(`Deleted ${periodTitle(h.period)}`, { action: () => (app.history = hist) })
  }
</script>

<section class="stack" style:--gap=".6rem">
    <button class="section-title toggle" aria-expanded={open} onclick={() => (open = !open)}>
      <History size={14} /> Past periods · {past.length}
      <ChevronDown size={14} class={open ? 'flip' : ''} />
    </button>
    {#if open && !past.length}
      <p class="small muted">
        No past periods yet. When you start a new period, the current plan is saved here so you can restore or repeat it.
      </p>
    {:else if open}
      <p class="small muted">Plans are kept here when you start a new period. Restore one to make it current again, or repeat it as a new period.</p>
      <ul class="card list">
        {#each past as h (h.period.id)}
          <li>
            <div class="info">
              <span class="nm">{periodTitle(h.period)}</span>
              <span class="tiny muted">{rangeLabel(h.period)} · {plural(servings(h), servingWord(h.period))}</span>
              <span class="tiny muted combos">
                {h.menu.map((m) => resolveCombo(app.lib, m.comboId)?.name ?? 'Private recipe').join(' · ')}
              </span>
            </div>
            <div class="row acts">
              <button class="btn sm" onclick={() => restore(h)} title="Make this the current period again"><RotateCcw size={14} /> Restore</button>
              <button class="btn sm ghost" onclick={() => repeat(h)} title="Copy this plan into a new period"><Repeat size={14} /> Repeat</button>
              <button class="btn icon sm ghost" aria-label="Delete {periodTitle(h.period)}" onclick={() => remove(h)}><Trash2 size={15} /></button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
</section>

<style>
  .toggle {
    border: 0;
    background: none;
    padding: 0.25rem 0;
    cursor: pointer;
    align-self: flex-start;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.75rem 0.6rem 0.75rem 1rem;
  }
  .list li + li {
    border-top: 1px solid var(--line);
  }
  .info {
    flex: 1;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .nm {
    font-weight: 650;
  }
  .combos {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .acts {
    gap: 0.25rem;
  }
</style>
