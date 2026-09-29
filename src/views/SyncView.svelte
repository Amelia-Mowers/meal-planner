<script lang="ts">
  import { ArrowLeftRight, Check, CircleAlert, QrCode, RefreshCw, Smartphone } from '@lucide/svelte'
  import { resolveCombo } from '../lib/combos'
  import { getKV, setKV } from '../lib/db'
  import { plural } from '../lib/format'
  import { decodePayload, type HandoffPayload } from '../lib/handoff'
  import { fnv1a } from '../lib/library'
  import { peopleOf, periodTitle, rangeLabel, servingWord } from '../lib/period'
  import { router } from '../lib/router.svelte'
  import { aisleLabel } from '../lib/shopping'
  import { app } from '../lib/store.svelte'
  import { applySync, decodeIncoming, missingOnThisDevice, preview, type IncomingSync, type SyncPreview } from '../lib/sync.svelte'
  import { ui } from '../lib/ui.svelte'

  let payload = $state<HandoffPayload | null>(null)
  let inc = $state.raw<IncomingSync | null>(null)
  let error = $state('')
  let done = $state<SyncPreview | null>(null)
  let showFallback = $state(false)
  let checked = $state<string[]>([])
  let key = ''

  $effect(() => {
    const frag = router.shared
    if (!frag || !app.ready) return
    key = 'shared:' + fnv1a(frag)
    done = null
    decodePayload(frag)
      .then(async (p) => {
        payload = p
        inc = decodeIncoming(p)
        checked = await getKV<string[]>(key, [])
      })
      .catch(() => (error = 'This link is damaged or incomplete. Try scanning the QR code again.'))
  })

  const plan = $derived(inc?.plan ?? null)
  const pv = $derived(inc && !done ? preview(inc) : null)
  const meals = $derived(plan ? plan.menu.reduce((s, m) => s + m.servings, 0) : 0)
  const missing = $derived(plan ? missingOnThisDevice(plan) : [])
  const stale = $derived(payload && payload.v !== app.lib.version)
  const replaces = $derived(!!pv && !pv.samePeriod && !!app.period && app.menu.length > 0)
  const nothingToDo = $derived(!!pv && pv.samePeriod && pv.planFrom !== 'theirs' && pv.marks.length === 0)
  const checkedSet = $derived(new Set(checked))
  const fallbackTotal = $derived(payload?.s?.reduce((n, [, items]) => n + items.length, 0) ?? 0)

  const markSummary = (p: SyncPreview) => {
    const cart = p.marks.filter((m) => m.list === 'inCart').length
    const prep = p.marks.filter((m) => m.list === 'prepDone').length
    const have = p.marks.filter((m) => m.list === 'have').length
    return [cart && plural(cart, 'shopping item'), prep && plural(prep, 'prep task'), have && plural(have, 'pantry item')]
      .filter(Boolean)
      .join(', ')
  }

  function leave() {
    history.replaceState(null, '', location.pathname + '#/plan')
    router.shared = null
    router.go('plan')
  }
  function sync() {
    if (inc) done = applySync(inc)
  }
  function showMine() {
    leave()
    ui.syncOpen = true
  }
  function toggle(id: string) {
    checked = checkedSet.has(id) ? checked.filter((x) => x !== id) : [...checked, id]
    setKV(key, $state.snapshot(checked))
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <span class="badge accent"><Smartphone size={12} /> From another device</span>
      {#if plan}
        <h1 style:margin-top=".4rem">{periodTitle(plan.period)}</h1>
        <p class="lede">{rangeLabel(plan.period)} · {plural(meals, servingWord(plan.period))} · {plural(plan.menu.length, 'combo')}{peopleOf(plan.period) > 1 ? ` · ${peopleOf(plan.period)} people` : ''}</p>
      {:else}
        <h1 style:margin-top=".4rem">Opening…</h1>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="callout"><CircleAlert size={18} /> {error}</div>
    <button class="btn" onclick={leave}>Open the app</button>
  {:else if done}
    <section class="card pad stack done" style:--gap=".75rem">
      <h2 class="row"><Check size={20} /> Synced</h2>
      <p class="small">
        {#if !done.samePeriod}
          This device now has {plan ? periodTitle(plan.period) : 'the plan'}.
        {:else}
          {done.planFrom === 'theirs' ? 'Took the newer plan from the other device.' : 'Kept this device’s plan (it was the same or newer).'}
          {done.marks.length ? `Updated ${markSummary(done)}.` : 'Checkmarks were already in step.'}
        {/if}
      </p>
      <p class="small muted">To finish the handshake, let the other device scan this one — then both have everything.</p>
      <div class="row wrap">
        <button class="btn primary" onclick={showMine}><QrCode size={16} /> Show my code</button>
        <button class="btn ghost" onclick={leave}>Done</button>
      </div>
    </section>
  {:else if plan && pv && payload}
    <section class="card pad stack" style:--gap=".7rem">
      {#if pv.samePeriod}
        <h2 class="row"><ArrowLeftRight size={20} /> Merge with this device</h2>
        <p class="small muted">
          Both devices have this period. Merging keeps the newer plan, and each checkmark keeps whichever device changed it last.
        </p>
        <ul class="changes small">
          <li>
            <strong>Plan:</strong>
            {pv.planFrom === 'theirs' ? 'take the other device’s (newer)' : pv.planFrom === 'mine' ? 'keep this device’s (newer)' : 'already the same'}
          </li>
          <li><strong>Checkmarks:</strong> {pv.marks.length ? `update ${markSummary(pv)}` : 'already in step'}</li>
        </ul>
      {:else}
        <h2>This period's plan</h2>
        <p class="small muted">
          Syncing copies the whole plan to this device — the combos below, their portions, your prep-set amounts and checkmarks. The
          shopping list and prep plan come with it, and everything works offline.
        </p>
        <ul class="combos small">
          {#each plan.menu as m (m.comboId)}
            {@const c = resolveCombo(app.lib, m.comboId)}
            <li><span class="num">{m.servings}×</span> {c?.name ?? 'Private recipe (not on this device)'}</li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if missing.length || stale}
      <div class="callout">
        <CircleAlert size={18} />
        <span>
          {#if missing.length}
            {plural(missing.length, 'item')} in this plan use recipes this device doesn't have (private recipes, or a newer library). They'll be
            left out of the prep plan{payload.s ? '; the list as sent is below' : ''}.
          {:else}
            This plan was made with a different version of the recipe library. Nutrition and amounts may differ slightly.
          {/if}
        </span>
      </div>
    {/if}

    {#if replaces && app.period}
      <p class="small muted">This replaces <strong>{periodTitle(app.period)}</strong> here. It'll be kept in your history.</p>
    {/if}

    <div class="row wrap">
      {#if nothingToDo}
        <span class="badge ok"><Check size={12} /> Already in sync</span>
        <button class="btn" onclick={showMine}><QrCode size={16} /> Show my code</button>
        <button class="btn ghost" onclick={leave}>Done</button>
      {:else}
        <button class="btn primary" onclick={sync}>
          <RefreshCw size={16} />
          {pv.samePeriod ? 'Merge' : 'Sync to this device'}
        </button>
        <button class="btn ghost" onclick={leave}>Not now</button>
      {/if}
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
  .done h2 {
    color: var(--ok);
  }
  .changes {
    margin: 0;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.25rem;
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
