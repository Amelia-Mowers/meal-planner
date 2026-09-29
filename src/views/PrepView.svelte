<script lang="ts">
  import { ChefHat, ChevronDown, Clock, CookingPot, Flame, Microwave, Refrigerator, ShieldCheck, Snowflake, Utensils, Check } from '@lucide/svelte'
  import { minutes } from '../lib/format'
  import { eatOrder, LANES, prepPlan, type Lane } from '../lib/prep'
  import { router } from '../lib/router.svelte'
  import { SAFETY_TIPS } from '../lib/safety'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'

  const ICON = { oven: Flame, rice: CookingPot, stove: ChefHat, micro: Microwave, counter: Utensils } satisfies Record<Lane, unknown>

  const plan = $derived(prepPlan(app.needs))
  const doneSet = $derived(new Set(app.prepDone))
  const done = $derived(plan.tasks.filter((t) => doneSet.has(t.id)).length)
  const eat = $derived(eatOrder(app.needs))
  const hasOven = $derived(plan.byLane.some(([l]) => l === 'oven'))
  const hasRice = $derived(plan.byLane.some(([l]) => l === 'rice'))
  let open = $state<Record<string, boolean>>({})
  let showSafety = $state(false)

  function reset() {
    const prev = app.prepDone
    app.prepDone = []
    toasts.show('Prep checklist reset', { action: () => (app.prepDone = prev) })
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Batch prep</h1>
      <p class="lede">Run the lanes in parallel: get the oven and rice cooker going first, then work the stovetop and counter while they cook.</p>
    </div>
  </div>

  {#if !plan.tasks.length}
    <div class="card empty">
      <ChefHat size={40} strokeWidth={1.5} />
      <h2>Nothing to prep yet</h2>
      <p>Your prep plan appears once you've added combos to your plan.</p>
      <button class="btn primary" onclick={() => router.go('plan')}>Go to plan</button>
    </div>
  {:else}
    <div class="summary card">
      <div class="stat"><Clock size={18} /><span><strong>≈ {minutes(plan.estimateMin)}</strong>{' '}<span class="muted small"> start to finish</span></span></div>
      <div class="stat"><Check size={18} /><span><strong class="num">{done}/{plan.tasks.length}</strong>{' '}<span class="muted small"> tasks done</span></span></div>
      <span class="spacer"></span>
      {#if done}<button class="btn sm ghost" onclick={reset}>Reset</button>{/if}
    </div>

    {#if hasOven || hasRice}
      <ol class="kickoff card">
        <li class="small">
          <strong>First:</strong>
          {[hasOven && 'heat the oven to 425°F / 220°C', hasRice && 'start the rice'].filter(Boolean).join(' and ')}. Everything else
          fits around it.
        </li>
      </ol>
    {/if}

    <div class="lanes">
      {#each plan.byLane as [lane, tasks] (lane)}
        {@const Icon = ICON[lane]}
        <section class="lane card">
          <header>
            <span class="lane-icon"><Icon size={18} /></span>
            <div>
              <h2>{LANES[lane].label}</h2>
              <p class="tiny muted">{LANES[lane].hint}</p>
            </div>
          </header>
          <ul>
            {#each tasks as t (t.id)}
              {@const isDone = doneSet.has(t.id)}
              <li class:done={isDone}>
                <div class="task">
                  <button class="tick" aria-pressed={isDone} aria-label="Mark {t.title} done" onclick={() => app.toggle('prepDone', t.id)}>
                    {#if isDone}<Check size={14} strokeWidth={3} />{/if}
                  </button>
                  <button class="t-main" aria-expanded={!!open[t.id]} onclick={() => (open = { ...open, [t.id]: !open[t.id] })}>
                    <span class="t-title">{t.title}</span>
                    <span class="tiny muted">{t.detail}</span>
                    <span class="tiny muted num">
                      {t.activeMin ? `${minutes(t.activeMin)} active` : ''}{t.activeMin && t.handsOffMin ? ' · ' : ''}{t.handsOffMin
                        ? `${minutes(t.handsOffMin)} cooking`
                        : ''}
                    </span>
                  </button>
                  <ChevronDown size={16} class="chev {open[t.id] ? 'flip' : ''}" />
                </div>
                {#if open[t.id]}
                  <ol class="steps small">
                    {#each t.steps as s, i (i)}<li>{s}</li>{/each}
                  </ol>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>

    {#if eat.length}
      <section class="card pad stack" style:--gap=".6rem">
        <h2 class="row"><Refrigerator size={18} /> Eat these first</h2>
        <p class="small muted">Shortest fridge life first. Freeze portions you won't reach in time.</p>
        <ul class="eat">
          {#each eat as c (c.id)}
            <li>
              <span>{c.name}</span>
              <span class="spacer"></span>
              <span class="badge" class:warn={(c.fridgeDays ?? 9) <= 3}>{c.fridgeDays} days</span>
              {#if c.freezable}<span class="badge" title="Freezes well"><Snowflake size={11} /> freezable</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="card pad">
      <button class="row safety-toggle" aria-expanded={showSafety} onclick={() => (showSafety = !showSafety)}>
        <ShieldCheck size={18} /> <h2>Food safety</h2> <span class="spacer"></span> <ChevronDown size={16} class={showSafety ? 'flip' : ''} />
      </button>
      {#if showSafety}
        <ul class="tips small">
          {#each SAFETY_TIPS as tip (tip)}<li>{tip}</li>{/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .pad {
    padding: 1rem 1.1rem;
  }
  .summary {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    padding: 0.8rem 1.1rem;
  }
  .stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--ink-2);
  }
  .kickoff {
    margin: 0;
    padding: 0.8rem 1.1rem;
    list-style: none;
    background: var(--accent-soft);
    border-color: transparent;
  }
  .lanes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
    gap: 0.75rem;
    align-items: start;
  }
  .lane header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--line);
  }
  .lane-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--accent);
  }
  .lane ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lane > ul > li {
    border-bottom: 1px solid var(--line);
  }
  .lane > ul > li:last-child {
    border-bottom: 0;
  }
  .task {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.8rem;
  }
  .tick {
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 2px solid var(--line-strong);
    background: transparent;
    display: grid;
    place-items: center;
    color: var(--accent-ink);
    padding: 0;
  }
  .done .tick {
    background: var(--accent);
    border-color: var(--accent);
  }
  .t-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 0.2rem 0;
    min-width: 0;
    color: var(--ink);
  }
  .t-title {
    font-weight: 620;
  }
  .done .t-title {
    text-decoration: line-through;
    color: var(--muted);
  }
  :global(.chev) {
    color: var(--muted);
    flex: none;
    transition: transform 0.15s;
  }
  .steps {
    margin: 0 1rem 0.8rem 3.1rem;
    padding-left: 1rem;
    display: grid;
    gap: 0.35rem;
    color: var(--ink-2);
  }
  .eat {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }
  .eat li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .safety-toggle {
    width: 100%;
    border: 0;
    background: none;
    padding: 0;
    color: var(--ink);
    text-align: left;
  }
  .tips {
    margin: 0.75rem 0 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.35rem;
  }
</style>
