<script lang="ts">
  import { ArrowRight, Recycle, Wand2 } from '@lucide/svelte'
  import { nutritionOf, suggest } from '../lib/combos'
  import { CUISINE_LABEL, plural } from '../lib/format'
  import { hitsTarget } from '../lib/nutrition'
  import { mealsTarget, periodTitle, servingWord } from '../lib/period'
  import { router } from '../lib/router.svelte'
  import { STARTER_PLANS } from '../lib/starterSets'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import type { Combo, Format } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import ComboCard from '../ui/ComboCard.svelte'

  const PAGE = 8
  let shown = $state(PAGE)
  let format = $state<Format | 'all'>('all')
  let cuisine = $state('all')
  let onlyHits = $state(false)

  const target = $derived(app.period ? mealsTarget(app.period) : 0)
  const keep = (c: Combo) =>
    (format === 'all' || c.format === format) &&
    (cuisine === 'all' || c.cuisine === cuisine) &&
    (!onlyHits || hitsTarget(nutritionOf(app.lib, c, app.portions[c.id]).n, app.targets)) &&
    (!app.onlyTested || app.isTested(c.id))

  const curated = $derived([...app.lib.combos.values()].filter(keep))
  /** Mix-and-match combos that reuse this period's prep set. */
  const pairs = $derived.by(() => {
    if (!app.prepSetIds.size) return []
    const inMenu = new Set(app.menu.map((m) => m.comboId))
    const s = suggest(app.lib, app.prepSetIds, app.targets, format)
    return s.generated.map((g) => g.combo).filter((c) => !inMenu.has(c.id) && keep(c))
  })

  function starter(s: (typeof STARTER_PLANS)[number]) {
    const prev = app.menu
    app.applyStarter(s)
    toasts.show(`Added “${s.name}” combos`, { action: () => (app.menu = prev) })
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Combos</h1>
      <p class="lede">
        {#if app.period}
          Add as many as you like to <strong>{periodTitle(app.period)}</strong> — each one adds its components to your prep set.
        {:else}
          Browse bowls and wraps. Adding one starts a week-long plan you can adjust on the Plan tab.
        {/if}
      </p>
    </div>
  </div>

  <section class="stack" style:--gap=".5rem">
    <h2 class="section-title">Quick plans</h2>
    <div class="starters">
      {#each STARTER_PLANS as s (s.id)}
        <button class="starter card" onclick={() => starter(s)}>
          <span class="emoji" aria-hidden="true">{s.emoji}</span>
          <span class="st-name">{s.name}</span>
          <span class="tiny muted">{s.blurb}</span>
        </button>
      {/each}
      <button class="starter card build" onclick={() => (ui.builderOpen = true)}>
        <span class="emoji" aria-hidden="true"><Wand2 size={22} /></span>
        <span class="st-name">Build your own</span>
        <span class="tiny muted">Mix and match any components</span>
      </button>
    </div>
  </section>

  <div class="filters row wrap">
    <div class="segmented" role="group" aria-label="Format">
      {#each [['all', 'All'], ['bowl', 'Bowls'], ['wrap', 'Wraps']] as [v, l] (v)}
        <button aria-pressed={format === v} onclick={() => (format = v as typeof format)}>{l}</button>
      {/each}
    </div>
    <select class="input sel" bind:value={cuisine} aria-label="Cuisine">
      <option value="all">All cuisines</option>
      {#each ['mexican', 'mediterranean', 'east-asian'] as c (c)}<option value={c}>{CUISINE_LABEL[c]}</option>{/each}
    </select>
    <button class="chip" aria-pressed={onlyHits} onclick={() => (onlyHits = !onlyHits)}>On target</button>
  </div>

  {#if pairs.length}
    <section class="stack" style:--gap=".6rem">
      <h2 class="section-title"><Recycle size={14} /> Pairs well with your plan</h2>
      <p class="small muted">Uses only components you're already prepping — more variety, no extra cooking.</p>
      <div class="grid">
        {#each pairs.slice(0, shown) as combo (combo.id)}<ComboCard {combo} compact />{/each}
      </div>
      {#if pairs.length > shown}
        <button class="btn more" onclick={() => (shown += PAGE)}>Show more ({pairs.length - shown} left)</button>
      {/if}
    </section>
  {/if}

  <section class="stack" style:--gap=".6rem">
    <h2 class="section-title">Curated</h2>
    {#if !curated.length}<p class="muted small">No curated combos match these filters.</p>{/if}
    <div class="grid">
      {#each curated as combo (combo.id)}<ComboCard {combo} />{/each}
    </div>
  </section>
</div>

{#if app.menuCount}
  <div class="cta">
    <div class="cta-inner card">
      <div class="stack" style:--gap="0">
        <strong>{plural(app.menuCount, servingWord(app.period))} planned</strong>
        <span class="small muted">
          {#if target}{target - app.menuCount > 0 ? `${target - app.menuCount} to go` : 'All meals covered'} · {/if}{plural(app.prepSetIds.size, 'component')}
        </span>
      </div>
      <button class="btn primary" onclick={() => router.go('plan')}>Review plan <ArrowRight size={16} /></button>
    </div>
  </div>
{/if}

<style>
  .starters {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 0.5rem;
  }
  @media (max-width: 600px) {
    .starters {
      grid-template-columns: 1fr 1fr;
    }
  }
  .starter {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    padding: 0.75rem 0.85rem;
    text-align: left;
    color: var(--ink);
  }
  .starter:hover {
    box-shadow: var(--shadow-2);
  }
  .build {
    border-style: dashed;
  }
  .build .emoji {
    color: var(--accent);
  }
  .emoji {
    font-size: 1.35rem;
    line-height: 1.3;
  }
  .st-name {
    font-weight: 700;
  }
  .sel {
    width: auto;
    min-height: 36px;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
    gap: 0.75rem;
    align-items: stretch;
  }
  .more {
    align-self: center;
  }
  .cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--nav-h) + var(--safe-b));
    padding: 0.75rem 1rem;
    pointer-events: none;
    z-index: 20;
  }
  @media (min-width: 900px) {
    .cta {
      left: 240px;
      bottom: 0;
      padding: 1.25rem 2rem;
    }
  }
  .cta-inner {
    pointer-events: auto;
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 0.65rem 0.65rem 1.1rem;
    box-shadow: var(--shadow-2);
  }
</style>
