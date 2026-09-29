<script lang="ts">
  import { ArrowRight, CalendarDays, ShoppingBasket, Trash2 } from '@lucide/svelte'
  import { nutritionOf, resolveCombo } from '../lib/combos'
  import { plural } from '../lib/format'
  import { add, scale, ZERO } from '../lib/nutrition'
  import { router } from '../lib/router.svelte'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import MacroBar from '../ui/MacroBar.svelte'
  import Stepper from '../ui/Stepper.svelte'
  import TargetBadge from '../ui/TargetBadge.svelte'

  const rows = $derived(
    app.menu
      .map((m) => {
        const combo = resolveCombo(app.lib, m.comboId)
        return combo ? { m, combo, nut: nutritionOf(app.lib, combo, app.portions[m.comboId]) } : null
      })
      .filter((r) => r !== null),
  )
  const missing = $derived(app.menu.filter((m) => !resolveCombo(app.lib, m.comboId)))
  const avg = $derived(
    app.menuCount
      ? scale(
          rows.reduce((acc, r) => add(acc, scale(r.nut.n, r.m.servings)), { ...ZERO }),
          1 / app.menuCount,
        )
      : ZERO,
  )
  const remaining = $derived(app.mealsPerWeek - app.menuCount)

  function clear() {
    const prev = app.menu
    app.menu = []
    toasts.show('Week cleared', { action: () => (app.menu = prev) })
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>This week</h1>
      <p class="lede">How many of each combo you plan to eat. This drives the shopping list and prep amounts.</p>
    </div>
  </div>

  {#if rows.length === 0}
    <div class="card empty">
      <CalendarDays size={40} strokeWidth={1.5} />
      <h2>Nothing planned yet</h2>
      <p>Add combos to your week from the Combos tab — or skip this and shop for one batch of everything in your prep set.</p>
      <div class="row wrap" style:justify-content="center">
        <button class="btn primary" onclick={() => router.go('combos')}>Browse combos <ArrowRight size={16} /></button>
        {#if app.prepSet.length}<button class="btn" onclick={() => router.go('shop')}>Shop prep set</button>{/if}
      </div>
    </div>
  {:else}
    <div class="summary card">
      <div class="meals">
        <span class="big num">{app.menuCount}</span>
        <span class="small muted">of {app.mealsPerWeek} meals planned</span>
        <div class="bar" aria-hidden="true"><div style:width="{Math.min(100, (app.menuCount / app.mealsPerWeek) * 100)}%"></div></div>
        {#if remaining > 0}
          <span class="tiny muted">{plural(remaining, 'more meal')} to go</span>
        {:else}
          <span class="tiny ok">Week covered</span>
        {/if}
      </div>
      <div class="avg">
        <div class="row"><span class="label">Average per meal</span><span class="spacer"></span><TargetBadge n={avg} targets={app.targets} /></div>
        <MacroBar n={avg} targets={app.targets} />
      </div>
    </div>

    <ul class="list">
      {#each rows as { m, combo, nut } (m.comboId)}
        <li class="card item">
          <div class="info">
            <span class="badge">{combo.format === 'bowl' ? 'Bowl' : 'Wrap'}</span>
            <h3>{combo.name}</h3>
            <span class="small muted num">{Math.round(nut.n.kcal)} kcal · {Math.round(nut.n.protein)} g protein</span>
          </div>
          <TargetBadge n={nut.n} targets={app.targets} />
          <Stepper value={m.servings} onchange={(v) => app.setServings(m.comboId, v)} label="servings of {combo.name}" />
        </li>
      {/each}
    </ul>

    {#if missing.length}
      <p class="callout">
        {plural(missing.length, 'planned combo')} reference components that aren't in this device's library (maybe private
        recipes from another device). They're skipped in the shopping list.
      </p>
    {/if}

    <div class="row wrap">
      <button class="btn ghost danger" onclick={clear}><Trash2 size={16} /> Clear week</button>
      <span class="spacer"></span>
      <button class="btn" onclick={() => router.go('combos')}>Add more</button>
      <button class="btn primary" onclick={() => router.go('shop')}><ShoppingBasket size={16} /> Shopping list</button>
    </div>
  {/if}
</div>

<style>
  .summary {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) 2fr;
    gap: 1.25rem;
    padding: 1rem 1.1rem;
  }
  @media (max-width: 560px) {
    .summary {
      grid-template-columns: 1fr;
    }
  }
  .meals {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .big {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    overflow: hidden;
    margin: 0.35rem 0 0.1rem;
  }
  .bar div {
    height: 100%;
    background: var(--accent);
    transition: width 0.25s;
  }
  .ok {
    color: var(--ok);
    font-weight: 650;
  }
  .avg {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.9rem;
    flex-wrap: wrap;
  }
  .info {
    flex: 1;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }
</style>
