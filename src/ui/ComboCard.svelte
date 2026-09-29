<script lang="ts">
  import { CalendarPlus, Check, ChevronDown, Plus, SlidersHorizontal, Sparkles, Star, Target } from '@lucide/svelte'
  import { fitBasePortion, flexPart, nutritionOf, sliderStep } from '../lib/combos'
  import { cuisineShort } from '../lib/format'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import type { Combo } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import { formatQty, ratio } from '../lib/units'
  import MacroBar from './MacroBar.svelte'
  import Stepper from './Stepper.svelte'
  import TargetBadge from './TargetBadge.svelte'

  let { combo, missing = [] }: { combo: Combo; missing?: string[] } = $props()

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  let adjusting = $state(false)
  const overrides = $derived(app.portions[combo.id] ?? {})
  const nut = $derived(nutritionOf(app.lib, combo, overrides))
  const servings = $derived(app.servingsOf(combo.id))
  const base = $derived(flexPart(app.lib, combo))
  const basePart = $derived(base ? combo.parts.find((p) => p.componentId === base.id) : undefined)
  const baseQty = $derived(base ? (overrides[base.id] ?? basePart?.qty ?? base.portion) : undefined)
  const baseVal = $derived(base && baseQty ? (ratio(baseQty, { value: 1, unit: base.portion.unit }) ?? base.portion.value) : 0)
  const tested = $derived(app.isTested(combo.id))
  const parts = $derived(
    combo.parts.map((p) => {
      const c = app.lib.components.get(p.componentId)
      return { p, c, qty: overrides[p.componentId] ?? p.qty ?? c?.portion }
    }),
  )
  const missingNames = $derived(missing.map((id) => app.lib.components.get(id)?.name ?? id))
  /** Whole combo is outside the prep set (inspiration mode). */
  const inspire = $derived(missing.length > 0 && missing.length === combo.parts.length)

  function setBase(v: number) {
    if (!base) return
    app.setPortion(combo.id, base.id, { value: v, unit: base.portion.unit })
  }
  function fit() {
    const q = fitBasePortion(app.lib, combo, app.targets, overrides)
    if (q && base) {
      app.setPortion(combo.id, base.id, q)
      toasts.show(`${base.shortName} set to ${formatQty(q)}`)
    }
  }
  function addMissing() {
    app.prepSet = [...app.prepSet, ...missing.filter((id) => !app.prepSetIds.has(id))]
    toasts.show(inspire ? `Added ${combo.name} components to your prep set` : `Added ${missingNames.join(', ')} to your prep set`, {
      action: () => (app.prepSet = app.prepSet.filter((id) => !missing.includes(id))),
    })
  }
  function add() {
    app.setServings(combo.id, 1)
    toasts.show(`Added ${combo.name} to your week`)
  }
</script>

<article class="card combo" class:in-menu={servings > 0}>
  <header>
    <div class="titles">
      <div class="row wrap meta">
        <span class="badge">{combo.format === 'bowl' ? 'Bowl' : 'Wrap'}</span>
        <span class="badge cz" style:--c="var(--cz-{combo.cuisine}, var(--cz-neutral))">{cuisineShort(combo.cuisine)}</span>
        {#if combo.curated}
          <span class="badge accent" title="Hand-picked combination"><Star size={11} /> Curated</span>
        {:else}
          <span class="badge" title="Generated from your prep set"><Sparkles size={11} /> Suggested</span>
        {/if}
        {#if tested}<span class="badge ok"><Check size={11} /> Tested</span>{/if}
      </div>
      <h3>{combo.name}</h3>
      {#if combo.description}<p class="muted small desc">{combo.description}</p>{/if}
    </div>
    <TargetBadge n={nut.n} targets={app.targets} />
  </header>

  <ul class="parts" aria-label="Components">
    {#each parts as { p, c, qty } (p.componentId)}
      <li>
        <button
          class="part"
          style:--c="var(--role-{c?.role ?? 'veg'})"
          class:missing={!inspire && missing.includes(p.componentId)}
          onclick={() => (ui.detail = p.componentId)}
        >
          <span class="dot"></span>
          <span class="nm">{cap(c?.shortName ?? p.componentId)}</span>
          {#if qty}<span class="q num">{formatQty(qty)}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>

  <MacroBar n={nut.n} targets={app.targets} approximate={nut.approximate} />

  {#if adjusting && base?.portionRange}
    <div class="adjust">
      <div class="row">
        <label class="label" for="base-{combo.id}">{base.shortName}</label>
        <span class="spacer"></span>
        <span class="num strong">{formatQty({ value: baseVal, unit: base.portion.unit })}</span>
      </div>
      <input
        id="base-{combo.id}"
        type="range"
        min={base.portionRange[0]}
        max={base.portionRange[1]}
        step={sliderStep(base)}
        value={baseVal}
        oninput={(e) => setBase(Number(e.currentTarget.value))}
      />
      <div class="row small muted">
        <span>{formatQty({ value: base.portionRange[0], unit: base.portion.unit })}</span>
        <span class="spacer"></span>
        <span>{formatQty({ value: base.portionRange[1], unit: base.portion.unit })}</span>
      </div>
      <div class="row wrap">
        <button class="btn sm" onclick={fit}><Target size={14} /> Fit to {app.targets.kcal} kcal</button>
        {#if overrides[base.id]}
          <button class="btn sm ghost" onclick={() => app.setPortion(combo.id, base.id, null)}>Reset</button>
        {/if}
      </div>
    </div>
  {/if}

  <footer>
    {#if missing.length}
      <span class="small muted need">
        {inspire ? `Uses ${missing.length} components` : `Needs ${missingNames.join(', ')}`}
      </span>
      <button class="btn sm" class:primary={inspire} onclick={addMissing}>
        <Plus size={14} />
        {inspire ? 'Use these' : 'Add to set'}
      </button>
    {:else}
      {#if base?.portionRange}
        <button class="btn sm ghost" aria-expanded={adjusting} onclick={() => (adjusting = !adjusting)}>
          <SlidersHorizontal size={14} /> Portions <ChevronDown size={14} class={adjusting ? 'flip' : ''} />
        </button>
      {/if}
      <span class="spacer"></span>
      {#if servings > 0}
        <span class="small muted">This week</span>
        <Stepper value={servings} onchange={(v) => app.setServings(combo.id, v)} label="servings of {combo.name}" />
      {:else}
        <button class="btn sm primary" onclick={add}><CalendarPlus size={14} /> Add to week</button>
      {/if}
    {/if}
  </footer>
</article>

<style>
  .combo {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 1rem;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .combo.in-menu {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  header {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .meta {
    gap: 0.3rem;
  }
  .cz {
    background: color-mix(in srgb, var(--c) 14%, transparent);
    color: var(--c);
  }
  .desc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .parts {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .part {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--line);
    background: var(--surface-2);
    border-radius: 999px;
    padding: 0.25rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 550;
    color: var(--ink);
    min-height: 30px;
  }
  .part:hover {
    border-color: var(--c);
  }
  .part .dot {
    background: var(--c);
  }
  .part .q {
    color: var(--muted);
    font-weight: 500;
  }
  .part.missing {
    border-style: dashed;
    border-color: var(--warn);
    background: var(--warn-soft);
  }
  .adjust {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.8rem;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .strong {
    font-weight: 700;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding-top: 0.75rem;
    border-top: 1px solid var(--line);
    margin-top: auto;
  }
  .need {
    flex: 1;
    min-width: 0;
  }
  :global(.flip) {
    transform: rotate(180deg);
  }
</style>
