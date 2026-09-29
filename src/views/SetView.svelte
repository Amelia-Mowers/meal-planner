<script lang="ts">
  import { ArrowRight, Check, Info, RotateCcw } from '@lucide/svelte'
  import { suggest } from '../lib/combos'
  import { CUISINE_LABEL, ROLE_PLURAL, plural } from '../lib/format'
  import { componentNutrition } from '../lib/nutrition'
  import { router } from '../lib/router.svelte'
  import { ROLE_TARGETS, STARTER_SETS, type StarterSet } from '../lib/starterSets'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import { ROLES, type Component, type Role } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import CuisineDots from '../ui/CuisineDots.svelte'

  let cuisine = $state<string>('all')

  const all = $derived([...app.lib.components.values()])
  const visible = $derived(
    all.filter(
      (c) =>
        (cuisine === 'all' || c.cuisines.includes(cuisine) || c.cuisines.includes('neutral')) &&
        (!app.onlyTested || app.isTested(c.id) || app.prepSetIds.has(c.id)),
    ),
  )
  const byRole = $derived(
    Object.fromEntries(ROLES.map((r) => [r, visible.filter((c) => c.role === r)])) as Record<Role, Component[]>,
  )
  const counts = $derived(
    Object.fromEntries(ROLES.map((r) => [r, app.prepSet.filter((id) => app.lib.components.get(id)?.role === r).length])) as Record<Role, number>,
  )
  const comboCount = $derived.by(() => {
    if (!app.prepSet.length) return 0
    const s = suggest(app.lib, app.prepSetIds, app.targets, app.format)
    return s.curated.length + s.generated.length
  })

  function applyStarter(s: StarterSet) {
    const prev = app.prepSet
    app.prepSet = s.components.filter((id) => app.lib.components.has(id))
    toasts.show(`Loaded “${s.name}” — ${plural(app.prepSet.length, 'component')}`, { action: () => (app.prepSet = prev) })
  }
  function clear() {
    const prev = app.prepSet
    app.prepSet = []
    toasts.show('Prep set cleared', { action: () => (app.prepSet = prev) })
  }
  const status = (r: Role) => {
    const t = ROLE_TARGETS[r]
    const n = counts[r]
    if (n === 0) return 'empty'
    return n >= t.min && n <= t.max ? 'ok' : n > t.max ? 'over' : 'under'
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Prep set</h1>
      <p class="lede">Pick a handful of components to batch-prep this week. We'll turn them into bowls and wraps.</p>
    </div>
  </div>

  <section class="stack" style:--gap=".6rem" aria-labelledby="starters">
    <h2 id="starters" class="section-title">Start from a set</h2>
    <div class="starters">
      {#each STARTER_SETS as s (s.id)}
        <button class="starter card" onclick={() => applyStarter(s)}>
          <span class="emoji" aria-hidden="true">{s.emoji}</span>
          <span class="st-name">{s.name}</span>
          <span class="small muted">{s.blurb}</span>
        </button>
      {/each}
    </div>
  </section>

  <div class="progress card" aria-label="Prep set balance">
    {#each ROLES as r (r)}
      <div class="prog {status(r)}" style:--c="var(--role-{r})">
        <span class="n num">{counts[r]}</span>
        <span class="lbl">{ROLE_PLURAL[r]}</span>
        <span class="tiny hint">{ROLE_TARGETS[r].hint}</span>
      </div>
    {/each}
  </div>

  <div class="filters row wrap">
    <div class="row wrap" role="group" aria-label="Filter by cuisine">
      {#each ['all', 'mexican', 'mediterranean', 'east-asian'] as cz (cz)}
        <button class="chip" aria-pressed={cuisine === cz} onclick={() => (cuisine = cz)}>
          {#if cz !== 'all'}<span class="dot" style:background="var(--cz-{cz})"></span>{/if}
          {cz === 'all' ? 'All cuisines' : CUISINE_LABEL[cz]}
        </button>
      {/each}
    </div>
    <span class="spacer"></span>
    <label class="row small toggle">
      <input type="checkbox" bind:checked={app.onlyTested} /> Tested only
    </label>
    {#if app.prepSet.length}
      <button class="btn sm ghost" onclick={clear}><RotateCcw size={14} /> Clear</button>
    {/if}
  </div>

  {#each ROLES as r (r)}
    <section class="stack" style:--gap=".6rem" aria-labelledby="role-{r}">
      <h2 id="role-{r}" class="section-title">
        <span class="dot" style:background="var(--role-{r})"></span>
        {ROLE_PLURAL[r]}
        <span class="muted tiny" style:text-transform="none" style:letter-spacing="0">· {ROLE_TARGETS[r].hint}</span>
      </h2>
      {#if byRole[r].length === 0}
        <p class="muted small">Nothing matches these filters.</p>
      {/if}
      <div class="grid">
        {#each byRole[r] as c (c.id)}
          {@const on = app.prepSetIds.has(c.id)}
          {@const n = componentNutrition(app.lib, c).n}
          <div class="comp card" class:on style:--c="var(--role-{r})">
            <button class="pick" aria-pressed={on} onclick={() => app.toggleInSet(c.id)}>
              <span class="check" aria-hidden="true">{#if on}<Check size={14} strokeWidth={3} />{/if}</span>
              <span class="body">
                <span class="nm">{c.name}</span>
                <span class="row meta tiny muted">
                  <CuisineDots cuisines={c.cuisines} />
                  <span class="num">{Math.round(n.kcal)} kcal · {Math.round(n.protein)} g protein</span>
                </span>
                <span class="row tags">
                  {#if c.keywords.includes('pickled')}<span class="badge">Pickled</span>{/if}
                  {#if c.secondary}<span class="badge">Add-on</span>{/if}
                  {#if c.prepMin + c.cookMin === 0}<span class="badge">No prep</span>{/if}
                  {#if app.isTested(c.id)}<span class="badge ok">Tested</span>{/if}
                  {#if c.source === 'private'}<span class="badge accent">Private</span>{/if}
                </span>
              </span>
            </button>
            <button class="btn icon sm ghost info" onclick={() => (ui.detail = c.id)} aria-label="Details for {c.name}">
              <Info size={16} />
            </button>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

{#if app.prepSet.length}
  <div class="cta">
    <div class="cta-inner card">
      <div class="stack" style:--gap="0">
        <strong>{plural(app.prepSet.length, 'component')}</strong>
        <span class="small muted">{plural(comboCount, 'combo')} possible</span>
      </div>
      <button class="btn primary" onclick={() => router.go('combos')}>See combos <ArrowRight size={16} /></button>
    </div>
  </div>
{/if}

<style>
  .starters {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 0.6rem;
  }
  @media (max-width: 600px) {
    .starters {
      grid-template-columns: 1fr 1fr;
    }
    .starter {
      padding: 0.7rem 0.8rem;
    }
    .starter .small {
      font-size: 0.78rem;
      line-height: 1.3;
    }
  }
  .starter {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    padding: 0.85rem 1rem;
    text-align: left;
    color: var(--ink);
    transition:
      transform 0.1s,
      box-shadow 0.15s;
  }
  .starter:hover {
    box-shadow: var(--shadow-2);
    transform: translateY(-1px);
  }
  .emoji {
    font-size: 1.5rem;
    line-height: 1.2;
  }
  .st-name {
    font-weight: 700;
  }
  .progress {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: 0.6rem;
    gap: 0.25rem;
  }
  .prog {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0.35rem 0.2rem;
    border-radius: var(--radius-sm);
  }
  .prog .n {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--c);
    line-height: 1.1;
  }
  .prog .lbl {
    font-size: 0.8rem;
    font-weight: 650;
  }
  .prog .hint {
    color: var(--muted);
  }
  .prog.ok {
    background: color-mix(in srgb, var(--c) 10%, transparent);
  }
  @media (max-width: 520px) {
    .prog .hint {
      display: none;
    }
  }
  .toggle {
    gap: 0.4rem;
    min-height: 36px;
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0.5rem;
  }
  .comp {
    position: relative;
    display: flex;
    align-items: stretch;
    overflow: hidden;
    transition:
      border-color 0.15s,
      background 0.15s;
  }
  .comp.on {
    border-color: var(--c);
    background: color-mix(in srgb, var(--c) 7%, var(--surface));
  }
  .pick {
    flex: 1;
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 0.75rem 0 0.75rem 0.8rem;
    color: var(--ink);
    min-width: 0;
  }
  .check {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 2px solid var(--line-strong);
    display: grid;
    place-items: center;
    margin-top: 1px;
    color: #fff;
    transition: all 0.12s;
  }
  .on .check {
    background: var(--c);
    border-color: var(--c);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .nm {
    font-weight: 620;
    line-height: 1.25;
  }
  .meta {
    gap: 0.45rem;
  }
  .tags {
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .tags:empty {
    display: none;
  }
  .info {
    align-self: flex-start;
    margin: 0.45rem 0.35rem 0 0;
    color: var(--muted);
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
