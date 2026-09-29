<script lang="ts">
  import { Check, ChevronRight, Lock, Search, TriangleAlert } from '@lucide/svelte'
  import { cuisineShort, plural, ROLE_PLURAL } from '../lib/format'
  import { componentNutrition, partsNutrition } from '../lib/nutrition'
  import { app } from '../lib/store.svelte'
  import { ROLES, type Role } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import CuisineDots from '../ui/CuisineDots.svelte'
  import TargetBadge from '../ui/TargetBadge.svelte'

  let q = $state('')
  let kind = $state<'components' | 'combos'>('components')
  let role = $state<Role | 'all'>('all')
  let source = $state<'all' | 'bundled' | 'private'>('all')

  const match = (text: string) => text.toLowerCase().includes(q.trim().toLowerCase())
  const comps = $derived(
    [...app.lib.components.values()].filter(
      (c) =>
        (role === 'all' || c.role === role) &&
        (source === 'all' || c.source === source) &&
        (!app.onlyTested || app.isTested(c.id)) &&
        (!q || match(c.name + ' ' + c.description + ' ' + c.supplies.map((s) => app.lib.foods.get(s.foodId)?.name).join(' '))),
    ),
  )
  const combos = $derived(
    [...app.lib.combos.values()].filter(
      (c) =>
        (source === 'all' || c.source === source) &&
        (!app.onlyTested || app.isTested(c.id)) &&
        (!q || match(c.name + ' ' + c.description)),
    ),
  )
  const privateCount = $derived([...app.lib.components.values()].filter((c) => c.source === 'private').length)
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Library</h1>
      <p class="lede">
        {plural(app.lib.components.size, 'component')} and {plural(app.lib.combos.size, 'curated combo')}. Nutrition is computed from
        USDA FoodData Central — never guessed.
      </p>
    </div>
  </div>

  <div class="stack" style:--gap=".6rem">
    <label class="search">
      <Search size={18} />
      <span class="sr-only">Search the library</span>
      <input class="input" type="search" placeholder="Search components, combos, ingredients…" bind:value={q} />
    </label>
    <div class="row wrap">
      <div class="segmented" role="group" aria-label="Show">
        <button aria-pressed={kind === 'components'} onclick={() => (kind = 'components')}>Components</button>
        <button aria-pressed={kind === 'combos'} onclick={() => (kind = 'combos')}>Combos</button>
      </div>
      {#if privateCount}
        <select class="input sel" bind:value={source} aria-label="Source">
          <option value="all">All sources</option>
          <option value="bundled">Starter library</option>
          <option value="private">Private</option>
        </select>
      {/if}
      <label class="row small toggle"><input type="checkbox" bind:checked={app.onlyTested} /> Tested only</label>
    </div>
    {#if kind === 'components'}
      <div class="row wrap" role="group" aria-label="Role">
        <button class="chip" aria-pressed={role === 'all'} onclick={() => (role = 'all')}>All</button>
        {#each ROLES as r (r)}
          <button class="chip" aria-pressed={role === r} onclick={() => (role = r)}>
            <span class="dot" style:background="var(--role-{r})"></span>{ROLE_PLURAL[r]}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if kind === 'components'}
    {#if !comps.length}<p class="muted">No components match.</p>{/if}
    <ul class="card list">
      {#each comps as c (c.id)}
        {@const n = componentNutrition(app.lib, c)}
        <li>
          <button class="rowbtn" onclick={() => (ui.detail = c.id)}>
            <span class="dot" style:background="var(--role-{c.role})" title={c.role}></span>
            <span class="main">
              <span class="nm">
                {c.name}
                {#if c.source === 'private'}<Lock size={12} />{/if}
                {#if app.isTested(c.id)}<Check size={13} class="ok-ic" />{/if}
                {#if c.needsReview}<TriangleAlert size={13} class="warn-ic" />{/if}
              </span>
              <span class="tiny muted row"><CuisineDots cuisines={c.cuisines} label /></span>
            </span>
            <span class="nums tiny muted num">{n.approximate ? '≈' : ''}{Math.round(n.n.kcal)} kcal<br />{Math.round(n.n.protein)} g P</span>
            <ChevronRight size={16} class="chev" />
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="card list">
      {#each combos as c (c.id)}
        {@const n = partsNutrition(app.lib, c.parts)}
        <li>
          <button class="rowbtn" onclick={() => (ui.detail = c.id)}>
            <span class="main">
              <span class="nm">{c.name} {#if app.isTested(c.id)}<Check size={13} class="ok-ic" />{/if}</span>
              <span class="tiny muted">{c.format === 'bowl' ? 'Bowl' : 'Wrap'} · {cuisineShort(c.cuisine)} · {Math.round(n.n.kcal)} kcal · {Math.round(n.n.protein)} g protein</span>
            </span>
            <TargetBadge n={n.n} targets={app.targets} />
            <ChevronRight size={16} class="chev" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    display: block;
  }
  .search :global(svg) {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    translate: 0 -50%;
    color: var(--muted);
  }
  .search .input {
    padding-left: 2.6rem;
    border-radius: 999px;
    min-height: 46px;
  }
  .sel {
    width: auto;
    min-height: 36px;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
  }
  .toggle {
    gap: 0.4rem;
    cursor: pointer;
    min-height: 36px;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .list li + li {
    border-top: 1px solid var(--line);
  }
  .rowbtn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.75rem 0.9rem;
    border: 0;
    background: transparent;
    text-align: left;
    color: var(--ink);
    min-height: 56px;
  }
  .rowbtn:hover {
    background: var(--surface-2);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .nm {
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .nums {
    text-align: right;
    line-height: 1.3;
  }
  :global(.ok-ic) {
    color: var(--ok);
  }
  :global(.warn-ic) {
    color: var(--warn);
  }
  .rowbtn :global(.chev) {
    color: var(--muted);
    flex: none;
  }
</style>
