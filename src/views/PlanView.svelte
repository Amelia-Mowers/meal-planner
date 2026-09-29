<script lang="ts">
  import {
    ArrowLeftRight,
    CalendarPlus,
    CalendarRange,
    ChefHat,
    Pencil,
    Plus,
    RotateCcw,
    ShoppingBasket,
    ScanLine,
    Sparkles,
    Trash2,
    Wand2,
  } from '@lucide/svelte'
  import { nutritionOf, resolveCombo } from '../lib/combos'
  import { plural, ROLE_PLURAL } from '../lib/format'
  import { add, scale, ZERO } from '../lib/nutrition'
  import { mealsTarget, periodStatus, periodTitle, rangeLabel } from '../lib/period'
  import { batchText } from '../lib/prep'
  import { router } from '../lib/router.svelte'
  import { batchStep, type ComponentNeed } from '../lib/shopping'
  import { STARTER_PLANS } from '../lib/starterSets'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import { ROLES, type Role } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import { formatNumber, formatQty, humanize, ratio } from '../lib/units'
  import MacroBar from '../ui/MacroBar.svelte'
  import Stepper from '../ui/Stepper.svelte'
  import TargetBadge from '../ui/TargetBadge.svelte'

  const p = $derived(app.period)
  const target = $derived(p ? mealsTarget(p) : 0)
  const status = $derived(p ? periodStatus(p) : null)
  const remaining = $derived(target - app.menuCount)

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
    app.menuCount ? scale(rows.reduce((acc, r) => add(acc, scale(r.nut.n, r.m.servings)), { ...ZERO }), 1 / app.menuCount) : ZERO,
  )
  const byRole = $derived(
    Object.fromEntries(
      ROLES.map((r) => [r, [...app.needs.values()].filter((n) => n.component.role === r)]),
    ) as Record<Role, ComponentNeed[]>,
  )
  const activeCount = $derived(app.prepSetIds.size)
  const toBuy = $derived(app.shopping.filter((i) => !app.have.includes(i.foodId)).length)

  /** Default-size portions a batch count yields. */
  const portions = (n: ComponentNeed) =>
    ratio({ value: n.component.yield.value * n.batches, unit: n.component.yield.unit }, n.component.portion) ?? 0

  function clearMenu() {
    const prev = { menu: app.menu, adjust: app.adjust }
    app.menu = []
    app.adjust = {}
    toasts.show('Plan cleared', {
      action: () => {
        app.menu = prev.menu
        app.adjust = prev.adjust
      },
    })
  }
  function remove(comboId: string, name: string) {
    const n = app.servingsOf(comboId)
    app.setServings(comboId, 0)
    toasts.show(`Removed ${name}`, { action: () => app.setServings(comboId, n) })
  }
</script>

<div class="page">
  {#if !p}
    <section class="hero card">
      <CalendarRange size={40} strokeWidth={1.5} />
      <h1>Plan your prep</h1>
      <p class="muted">
        Pick a period — a week, half a week, whatever you cook for — then choose the bowls and wraps you want. We'll work out what
        to batch-prep, what to buy, and how to cook it all in one go.
      </p>
      <button class="btn primary" onclick={() => (ui.periodSheet = 'new')}><CalendarPlus size={18} /> Plan a period</button>
      <button class="btn ghost" onclick={() => (ui.scanOpen = true)}><ScanLine size={18} /> Scan a plan from another device</button>
    </section>
  {:else}
    <!-- ───── Period ───── -->
    <section class="period card">
      <div class="p-head">
        <div class="stack" style:--gap=".25rem">
          <div class="row wrap tiny">
            {#if status?.state === 'current'}
              <span class="badge ok">Day {status.day} of {p.days}</span>
            {:else if status?.state === 'upcoming'}
              <span class="badge accent">Upcoming</span>
            {:else}
              <span class="badge warn">Ended</span>
            {/if}
            <span class="muted">{rangeLabel(p)}</span>
          </div>
          <h1>{periodTitle(p)}</h1>
        </div>
        <div class="row">
          <button class="btn icon ghost" aria-label="Edit period" title="Edit period" onclick={() => (ui.periodSheet = 'edit')}><Pencil size={18} /></button>
          <button class="btn sm" onclick={() => (ui.periodSheet = 'new')}><CalendarPlus size={14} /> New period</button>
          {#if app.menuCount}
            <button class="btn sm primary" onclick={() => (ui.syncOpen = true)}><ArrowLeftRight size={14} /> Sync devices</button>
          {/if}
        </div>
      </div>

      <div class="meals">
        <div class="row">
          <span><strong class="big num">{app.menuCount}</strong> <span class="muted">of {target} meals planned</span></span>
          <span class="spacer"></span>
          {#if app.menuCount}<TargetBadge n={avg} targets={app.targets} />{/if}
        </div>
        <div class="bar" aria-hidden="true">
          <div class:over={app.menuCount > target} style:width="{Math.min(100, (app.menuCount / Math.max(1, target)) * 100)}%"></div>
        </div>
        <p class="tiny muted">
          {p.days} days × {plural(p.mealsPerDay, 'meal')} a day ·
          {#if remaining > 0}{plural(remaining, 'meal')} to go{:else if remaining === 0}all meals covered{:else}{-remaining} extra{/if}
        </p>
      </div>

      {#if status?.state === 'past'}
        <div class="callout info small">
          This period has ended. <button class="btn sm" onclick={() => (ui.periodSheet = 'new')}>Start the next one</button>
        </div>
      {/if}
    </section>

    <!-- ───── Meals ───── -->
    <section class="stack" style:--gap=".6rem">
      <div class="row">
        <h2 class="section-title">Meals</h2>
        <span class="spacer"></span>
        {#if rows.length}<button class="btn sm ghost danger" onclick={clearMenu}><Trash2 size={14} /> Clear</button>{/if}
      </div>

      {#if !rows.length}
        <div class="card empty-meals">
          <p class="muted small">Start from a themed plan — it fills your {target} meals — or pick combos yourself.</p>
          <div class="starters">
            {#each STARTER_PLANS as s (s.id)}
              <button class="starter" onclick={() => app.applyStarter(s)}>
                <span class="emoji" aria-hidden="true">{s.emoji}</span>
                <span class="st-name">{s.name}</span>
                <span class="tiny muted">{s.blurb}</span>
              </button>
            {/each}
          </div>
          <div class="row wrap" style:justify-content="center">
            <button class="btn primary" onclick={() => router.go('combos')}><Sparkles size={16} /> Browse combos</button>
            <button class="btn" onclick={() => (ui.builderOpen = true)}><Wand2 size={16} /> Build your own</button>
          </div>
        </div>
      {:else}
        <ul class="card list">
          {#each rows as { m, combo, nut } (m.comboId)}
            <li>
              <button class="info" onclick={() => (ui.detail = combo.id)}>
                <span class="nm">{combo.name}</span>
                <span class="tiny muted num">
                  {combo.format === 'bowl' ? 'Bowl' : 'Wrap'} · {Math.round(nut.n.kcal)} kcal · {Math.round(nut.n.protein)} g protein
                </span>
              </button>
              <TargetBadge n={nut.n} targets={app.targets} />
              <Stepper value={m.servings} min={1} onchange={(v) => app.setServings(m.comboId, v)} label="servings of {combo.name}" />
              <button class="btn icon sm ghost" aria-label="Remove {combo.name}" onclick={() => remove(m.comboId, combo.name)}>
                <Trash2 size={15} />
              </button>
            </li>
          {/each}
        </ul>
        {#if missing.length}
          <p class="callout small">
            {plural(missing.length, 'planned combo')} use recipes this device doesn't have (private recipes from another device?). They're
            left out of the prep set.
          </p>
        {/if}
        <div class="row wrap">
          <button class="btn" onclick={() => router.go('combos')}><Plus size={16} /> Add combos</button>
          <button class="btn ghost" onclick={() => (ui.builderOpen = true)}><Wand2 size={16} /> Build your own</button>
        </div>
        <div class="card avg">
          <span class="label">Average per meal</span>
          <MacroBar n={avg} targets={app.targets} />
        </div>
      {/if}
    </section>

    <!-- ───── Prep set ───── -->
    {#if app.needs.size}
      <section class="stack" style:--gap=".6rem">
        <div class="row">
          <h2 class="section-title">Prep set · {plural(activeCount, 'component')}</h2>
          <span class="spacer"></span>
          <button class="btn sm ghost" onclick={() => (ui.extraOpen = true)}><Plus size={14} /> Add extra</button>
        </div>
        <p class="small muted">
          What to batch-prep, sized to your meals. Adjust any amount — make extra, or skip something you already have.
        </p>
        {#each ROLES as r (r)}
          {#if byRole[r].length}
            <div class="card prep-group" style:--c="var(--role-{r})">
              <h3 class="g-title"><span class="dot"></span>{ROLE_PLURAL[r]}</h3>
              <ul>
                {#each byRole[r] as n (n.component.id)}
                  {@const c = n.component}
                  {@const skipped = n.batches === 0}
                  <li class:skipped>
                    <button class="c-info" onclick={() => (ui.detail = c.id)}>
                      <span class="nm">{c.name}</span>
                      <span class="tiny muted">
                        {#if skipped}
                          Skipped
                        {:else}
                          Makes {formatQty(humanize({ value: c.yield.value * n.batches, unit: c.yield.unit }))} · ~{formatNumber(portions(n), false)} portions
                        {/if}
                        {#if n.servings}· used in {plural(n.servings, 'meal')}{:else}· extra{/if}
                      </span>
                    </button>
                    {#if n.adjusted}
                      <button
                        class="btn icon sm ghost"
                        title={n.servings ? `Reset to ${batchText(n.autoBatches)}` : 'Remove extra'}
                        aria-label="Reset {c.name}"
                        onclick={() => app.setBatches(c.id, null)}
                      >
                        <RotateCcw size={14} />
                      </button>
                    {/if}
                    <Stepper
                      value={n.batches}
                      step={batchStep()}
                      max={10}
                      size="md"
                      format={(v) => (v === 0 ? 'Skip' : `${formatNumber(v)}×`)}
                      onchange={(v) => app.setBatches(c.id, v === n.autoBatches && n.servings ? null : v)}
                      label="batches of {c.name}"
                    />
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        {/each}
      </section>

      <!-- ───── Next steps ───── -->
      <section class="next">
        <button class="card step" onclick={() => router.go('shop')}>
          <ShoppingBasket size={22} />
          <span><strong>Shopping list</strong><span class="tiny muted">{plural(toBuy, 'item')} to buy</span></span>
        </button>
        <button class="card step" onclick={() => router.go('prep')}>
          <ChefHat size={22} />
          <span><strong>Prep plan</strong><span class="tiny muted">Cook it all in one session</span></span>
        </button>
        <button class="card step" onclick={() => (ui.syncOpen = true)}>
          <ArrowLeftRight size={22} />
          <span><strong>Sync devices</strong><span class="tiny muted">Plan & checkmarks, both ways</span></span>
        </button>
      </section>
    {/if}
  {/if}
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.9rem;
    padding: 2.5rem 1.5rem;
    color: var(--accent);
  }
  .hero h1,
  .hero p {
    color: var(--ink);
    max-width: 46ch;
  }
  .hero p {
    color: var(--muted);
  }
  .period {
    padding: 1.1rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .p-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .meals {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .big {
    font-size: 1.6rem;
    font-weight: 800;
  }
  .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--accent);
    transition: width 0.25s;
  }
  .bar div.over {
    background: var(--warn);
  }
  .callout.info {
    align-items: center;
    flex-wrap: wrap;
  }
  .empty-meals {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
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
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--ink);
  }
  .starter:hover {
    border-color: var(--accent);
  }
  .emoji {
    font-size: 1.35rem;
  }
  .st-name {
    font-weight: 700;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.5rem 0.55rem 0.9rem;
    flex-wrap: wrap;
  }
  .list li + li {
    border-top: 1px solid var(--line);
  }
  .info,
  .c-info {
    flex: 1;
    min-width: 160px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    border: 0;
    background: none;
    padding: 0.2rem 0;
    color: var(--ink);
  }
  .nm {
    font-weight: 620;
  }
  .avg {
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .prep-group {
    overflow: hidden;
  }
  .g-title {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.6rem 0.9rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 7%, var(--surface));
    border-bottom: 1px solid var(--line);
  }
  .g-title .dot {
    background: var(--c);
  }
  .prep-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .prep-group li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.5rem 0.45rem 0.9rem;
  }
  .prep-group li + li {
    border-top: 1px solid var(--line);
  }
  .skipped .nm {
    color: var(--muted);
    text-decoration: line-through;
  }
  .next {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.6rem;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.9rem 1rem;
    text-align: left;
    color: var(--accent);
  }
  .step:hover {
    box-shadow: var(--shadow-2);
  }
  .step span {
    display: flex;
    flex-direction: column;
    color: var(--ink);
  }
</style>
