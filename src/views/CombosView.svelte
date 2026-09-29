<script lang="ts">
  import { ListChecks, Sparkles } from '@lucide/svelte'
  import { suggest } from '../lib/combos'
  import { plural } from '../lib/format'
  import { hitsTarget } from '../lib/nutrition'
  import { router } from '../lib/router.svelte'
  import { app } from '../lib/store.svelte'
  import ComboCard from '../ui/ComboCard.svelte'

  const PAGE = 12
  let shown = $state(PAGE)
  let onlyHits = $state(false)

  const s = $derived(suggest(app.lib, app.prepSetIds, app.targets, app.format))
  const filterHits = <T extends { nutrition: { n: import('../lib/types').Nutrients } }>(xs: T[]) =>
    onlyHits ? xs.filter((x) => hitsTarget(x.nutrition.n, app.targets)) : xs
  const curated = $derived(filterHits(s.curated))
  const generated = $derived(filterHits(s.generated))
  const hits = $derived([...s.curated, ...s.generated].filter((x) => hitsTarget(x.nutrition.n, app.targets)).length)
  const total = $derived(s.curated.length + s.generated.length)
  const inspiration = $derived([...app.lib.combos.values()].filter((c) => app.format === 'all' || c.format === app.format))
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Combos</h1>
      <p class="lede">
        {#if app.prepSet.length}
          {plural(total, 'combo')} from your prep set · <strong>{hits}</strong> on target
          <span class="muted">({app.targets.kcal} kcal ±{Math.round(app.targets.tolerance * 100)}%, ≥{app.targets.protein} g protein)</span>
        {:else}
          Pick a prep set to get personalized combos. Meanwhile, here are the curated favorites.
        {/if}
      </p>
    </div>
  </div>

  <div class="row wrap">
    <div class="segmented" role="group" aria-label="Format">
      {#each [['all', 'All'], ['bowl', 'Bowls'], ['wrap', 'Wraps']] as [v, l] (v)}
        <button aria-pressed={app.format === v} onclick={() => (app.format = v as typeof app.format)}>{l}</button>
      {/each}
    </div>
    <button class="chip" aria-pressed={onlyHits} onclick={() => (onlyHits = !onlyHits)}>On target only</button>
    <span class="spacer"></span>
    {#if app.menuCount}
      <button class="btn sm" onclick={() => router.go('week')}><ListChecks size={14} /> Week · {app.menuCount}</button>
    {/if}
  </div>

  {#if !app.prepSet.length}
    <div class="grid">
      {#each inspiration as combo (combo.id)}
        <ComboCard {combo} missing={combo.parts.map((p) => p.componentId)} />
      {/each}
    </div>
  {:else}
    {#if curated.length}
      <section class="stack" style:--gap=".6rem">
        <h2 class="section-title">Curated</h2>
        <div class="grid">
          {#each curated as sg (sg.combo.id)}<ComboCard combo={sg.combo} />{/each}
        </div>
      </section>
    {/if}

    {#if s.almost.length && !onlyHits}
      <section class="stack" style:--gap=".6rem">
        <h2 class="section-title">One component away</h2>
        <div class="grid">
          {#each s.almost as sg (sg.combo.id)}<ComboCard combo={sg.combo} missing={sg.missing} />{/each}
        </div>
      </section>
    {/if}

    <section class="stack" style:--gap=".6rem">
      <h2 class="section-title"><Sparkles size={14} /> Suggested from your set</h2>
      {#if generated.length === 0}
        <div class="card empty">
          <h2>No combos yet</h2>
          <p>
            A combo needs a base, a protein, at least one veg and a sauce that share a flavor profile{app.format !== 'all'
              ? ` and work as a ${app.format}`
              : ''}. Try adding a neutral component or a sauce that matches your proteins.
          </p>
          <button class="btn" onclick={() => router.go('set')}>Edit prep set</button>
        </div>
      {:else}
        <div class="grid">
          {#each generated.slice(0, shown) as sg (sg.combo.id)}<ComboCard combo={sg.combo} />{/each}
        </div>
        {#if generated.length > shown}
          <button class="btn more" onclick={() => (shown += PAGE)}>Show more ({generated.length - shown} left)</button>
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
    gap: 0.75rem;
    align-items: stretch;
  }
  .more {
    align-self: center;
  }
</style>
