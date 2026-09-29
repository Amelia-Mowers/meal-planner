<script lang="ts">
  import { ArrowRight, Check, CircleAlert, Download, Smartphone } from '@lucide/svelte'
  import { resolveCombo } from '../lib/combos'
  import { setKV, getKV } from '../lib/db'
  import { plural } from '../lib/format'
  import { decodePayload, type HandoffPayload } from '../lib/handoff'
  import { fnv1a } from '../lib/library'
  import { router } from '../lib/router.svelte'
  import { aisleLabel } from '../lib/shopping'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'

  let payload = $state<HandoffPayload | null>(null)
  let error = $state('')
  let checked = $state<string[]>([])
  let key = $state('')

  $effect(() => {
    const frag = router.shared
    if (!frag) return
    key = 'shared:' + fnv1a(frag)
    decodePayload(frag)
      .then(async (p) => {
        payload = p
        checked = await getKV<string[]>(key, [])
      })
      .catch(() => (error = "This link is damaged or incomplete. Try scanning the QR code again."))
  })

  const total = $derived(payload ? payload.s.reduce((n, [, items]) => n + items.length, 0) : 0)
  const checkedSet = $derived(new Set(checked))
  const stale = $derived(payload && payload.v !== app.lib.version)
  const combos = $derived(payload ? payload.m.map(([id, n]) => ({ id, n, combo: resolveCombo(app.lib, id) })) : [])

  function toggle(id: string) {
    checked = checkedSet.has(id) ? checked.filter((x) => x !== id) : [...checked, id]
    setKV(key, $state.snapshot(checked))
  }
  function saveWeek() {
    if (!payload) return
    const prev = app.menu
    app.menu = combos.filter((c) => c.combo).map((c) => ({ comboId: c.id, servings: c.n }))
    app.prepSet = [...new Set(combos.flatMap((c) => c.combo?.parts.map((p) => p.componentId) ?? []))]
    toasts.show('Week saved to this device', { action: () => (app.menu = prev) })
  }
  function openApp() {
    history.replaceState(null, '', location.pathname + '#/shop')
    router.go('shop')
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <span class="badge accent"><Smartphone size={12} /> Shared list</span>
      <h1 style:margin-top=".4rem">Shopping list</h1>
      {#if payload}
        <p class="lede">{payload.t ? `Made ${payload.t} · ` : ''}{plural(total, 'item')}{payload.m.length ? ` for ${plural(payload.m.reduce((s, [, n]) => s + n, 0), 'meal')}` : ''}</p>
      {/if}
    </div>
  </div>

  {#if error}
    <div class="callout"><CircleAlert size={18} /> {error}</div>
    <button class="btn" onclick={openApp}>Open the app</button>
  {:else if !payload}
    <p class="muted">Opening list…</p>
  {:else}
    {#if stale}
      <div class="callout">
        <CircleAlert size={18} />
        <span>This list was made with a different version of the recipe library. The list below is exactly what was sent, but combos may
          differ if you save the week here.</span>
      </div>
    {/if}

    <div class="progress">
      <div class="bar"><div style:width="{total ? (checked.length / total) * 100 : 0}%"></div></div>
      <span class="small num"><strong>{checked.length}</strong> of {total} in cart</span>
    </div>

    {#each payload.s as [aisle, items] (aisle)}
      <section class="stack" style:--gap=".5rem">
        <h2 class="section-title">{aisleLabel(aisle)}</h2>
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
      </section>
    {/each}

    {#if combos.length}
      <section class="card pad stack" style:--gap=".5rem">
        <h2>The week</h2>
        <ul class="week small">
          {#each combos as c (c.id)}
            <li><span class="num">{c.n}×</span> {c.combo?.name ?? 'Private combo (not on this device)'}</li>
          {/each}
        </ul>
        <div class="row wrap">
          <button class="btn" onclick={saveWeek} disabled={!combos.some((c) => c.combo)}><Download size={16} /> Save week to this device</button>
        </div>
      </section>
    {/if}

    <button class="btn ghost" style:align-self="center" onclick={openApp}>Open the full app <ArrowRight size={16} /></button>
  {/if}
</div>

<style>
  .pad {
    padding: 1rem 1.1rem;
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--accent);
    transition: width 0.25s;
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
    min-height: 56px;
    font-size: 1rem;
  }
  .box {
    flex: none;
    width: 24px;
    height: 24px;
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
  .nm::first-letter {
    text-transform: uppercase;
  }
  .nm {
    flex: 1;
    font-weight: 600;
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
  .week {
    margin: 0;
    padding-left: 1.1rem;
  }
</style>
