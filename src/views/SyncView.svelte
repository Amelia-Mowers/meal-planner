<script lang="ts">
  import { Check, CircleAlert, RefreshCw, Smartphone } from '@lucide/svelte'
  import { resolveCombo } from '../lib/combos'
  import { getKV, setKV } from '../lib/db'
  import { plural } from '../lib/format'
  import { decodePayload, type HandoffPayload } from '../lib/handoff'
  import { fnv1a } from '../lib/library'
  import { periodTitle, rangeLabel } from '../lib/period'
  import { router } from '../lib/router.svelte'
  import { aisleLabel } from '../lib/shopping'
  import { app, type PastPeriod } from '../lib/store.svelte'
  import { applySync, missingOnThisDevice, payloadToPlan } from '../lib/sync.svelte'
  import { toasts } from '../lib/toast.svelte'

  let payload = $state<HandoffPayload | null>(null)
  let plan = $state<PastPeriod | null>(null)
  let error = $state('')
  let showFallback = $state(false)
  let checked = $state<string[]>([])
  let key = ''

  $effect(() => {
    const frag = router.shared
    if (!frag || !app.ready) return
    key = 'shared:' + fnv1a(frag)
    decodePayload(frag)
      .then(async (p) => {
        payload = p
        plan = payloadToPlan(p)
        checked = await getKV<string[]>(key, [])
      })
      .catch(() => (error = 'This link is damaged or incomplete. Try scanning the QR code again.'))
  })

  const meals = $derived(plan ? plan.menu.reduce((s, m) => s + m.servings, 0) : 0)
  const missing = $derived(plan ? missingOnThisDevice(plan) : [])
  const stale = $derived(payload && payload.v !== app.lib.version)
  const samePeriod = $derived(plan && app.period?.id === plan.period.id)
  const replaces = $derived(!!app.period && !samePeriod && app.menu.length > 0)
  const checkedSet = $derived(new Set(checked))
  const fallbackTotal = $derived(payload?.s?.reduce((n, [, items]) => n + items.length, 0) ?? 0)

  function leave(route: 'shop' | 'plan' | 'prep') {
    history.replaceState(null, '', location.pathname + `#/${route}`)
    router.shared = null
    router.go(route)
  }
  function sync() {
    if (!plan) return
    const msg = samePeriod ? 'Plan updated on this phone' : `Synced ${periodTitle(plan.period)}`
    applySync(plan)
    toasts.show(msg)
    leave('plan')
  }
  function toggle(id: string) {
    checked = checkedSet.has(id) ? checked.filter((x) => x !== id) : [...checked, id]
    setKV(key, $state.snapshot(checked))
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <span class="badge accent"><Smartphone size={12} /> Sync from another device</span>
      {#if plan}
        <h1 style:margin-top=".4rem">{periodTitle(plan.period)}</h1>
        <p class="lede">{rangeLabel(plan.period)} · {plural(meals, 'meal')} · {plural(plan.menu.length, 'combo')}</p>
      {:else}
        <h1 style:margin-top=".4rem">Syncing…</h1>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="callout"><CircleAlert size={18} /> {error}</div>
    <button class="btn" onclick={() => leave('plan')}>Open the app</button>
  {:else if plan && payload}
    <section class="card pad stack" style:--gap=".7rem">
      <h2>This period's plan</h2>
      <p class="small muted">
        Syncing copies the whole plan to this phone — the combos below, their portions and your prep-set amounts. The shopping
        list and prep plan come with it, and everything works offline. Scan again any time to update.
      </p>
      <ul class="combos small">
        {#each plan.menu as m (m.comboId)}
          {@const c = resolveCombo(app.lib, m.comboId)}
          <li><span class="num">{m.servings}×</span> {c?.name ?? 'Private recipe (not on this device)'}</li>
        {/each}
      </ul>
    </section>

    {#if missing.length || stale}
      <div class="callout">
        <CircleAlert size={18} />
        <span>
          {#if missing.length}
            {plural(missing.length, 'item')} in this plan use recipes this phone doesn't have (private recipes, or a newer library). They'll be
            left out of the prep plan{payload.s ? '; the list as sent is below' : ''}.
          {:else}
            This plan was made with a different version of the recipe library. Nutrition and amounts may differ slightly.
          {/if}
        </span>
      </div>
    {/if}

    {#if replaces && app.period}
      <p class="small muted">
        This replaces <strong>{periodTitle(app.period)}</strong> on this phone. It'll be kept in your history.
      </p>
    {:else if samePeriod}
      <p class="small muted">You already have this period here — syncing updates it and keeps your checkmarks.</p>
    {/if}

    <div class="row wrap">
      <button class="btn primary" onclick={sync}><RefreshCw size={16} /> {samePeriod ? 'Update this phone' : 'Sync to this phone'}</button>
      <button class="btn ghost" onclick={() => leave('plan')}>Not now</button>
    </div>

    {#if payload.s?.length}
      <section class="stack" style:--gap=".6rem">
        <button class="btn sm ghost" style:align-self="flex-start" onclick={() => (showFallback = !showFallback)}>
          {showFallback ? 'Hide' : 'Show'} the list as sent ({plural(fallbackTotal, 'item')})
        </button>
        {#if showFallback}
          {#each payload.s as [aisle, items] (aisle)}
            <h3 class="section-title">{aisleLabel(aisle)}</h3>
            <ul class="card items">
              {#each items as [name, amount] (name)}
                {@const id = aisle + '/' + name}
                {@const on = checkedSet.has(id)}
                <li class:on>
                  <button class="item" aria-pressed={on} onclick={() => toggle(id)}>
                    <span class="box" aria-hidden="true">{#if on}<Check size={14} strokeWidth={3} />{/if}</span>
                    <span class="nm">{name}</span>
                    <span class="amt num">{amount}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/each}
        {/if}
      </section>
    {/if}
  {:else}
    <p class="muted">Opening…</p>
  {/if}
</div>

<style>
  .pad {
    padding: 1rem 1.1rem;
  }
  .combos {
    margin: 0;
    padding: 0.75rem 0 0 1.1rem;
    border-top: 1px solid var(--line);
    color: var(--ink-2);
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .items li + li {
    border-top: 1px solid var(--line);
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.8rem 1rem;
    border: 0;
    background: transparent;
    color: var(--ink);
    text-align: left;
    min-height: 52px;
  }
  .box {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--line-strong);
    display: grid;
    place-items: center;
    color: var(--accent-ink);
  }
  .on .box {
    background: var(--accent);
    border-color: var(--accent);
  }
  .nm {
    flex: 1;
    font-weight: 600;
  }
  .nm::first-letter {
    text-transform: uppercase;
  }
  .on .nm,
  .on .amt {
    text-decoration: line-through;
    color: var(--muted);
  }
  .amt {
    font-weight: 650;
    white-space: nowrap;
  }
</style>
