<script lang="ts">
  import { Check, ClipboardCopy, House, RotateCcw, ShoppingBasket, Undo2 } from '@lucide/svelte'
  import { plural } from '../lib/format'
  import { periodTitle } from '../lib/period'
  import { router } from '../lib/router.svelte'
  import { aisleLabel, groupByAisle, listAsText, type ShoppingItem } from '../lib/shopping'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'

  let showHave = $state(false)
  const haveSet = $derived(new Set(app.have))
  const cartSet = $derived(new Set(app.inCart))
  const toBuy = $derived(app.shopping.filter((i) => !haveSet.has(i.foodId)))
  const have = $derived(app.shopping.filter((i) => haveSet.has(i.foodId)))
  const groups = $derived(groupByAisle(toBuy))
  const done = $derived(toBuy.filter((i) => cartSet.has(i.foodId)).length)
  const basis = $derived(
    app.period ? `${periodTitle(app.period)} · ${plural(app.menuCount, 'meal')}, ${plural(app.prepSetIds.size, 'component')}` : '',
  )

  async function copyText() {
    await navigator.clipboard.writeText(listAsText(app.shopping, haveSet))
    toasts.show('Shopping list copied')
  }
  function markHave(i: ShoppingItem) {
    app.toggle('have', i.foodId)
    toasts.show(`Moved ${i.name} to “Already have”`, { action: () => app.toggle('have', i.foodId) })
  }
  function resetChecks() {
    const prev = app.inCart
    app.inCart = []
    toasts.show('Unchecked everything', { action: () => (app.inCart = prev) })
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <h1>Shopping list</h1>
      <p class="lede">{basis}{basis ? '. ' : ''}Grouped by aisle; amounts rounded up to what the store sells.</p>
    </div>
  </div>

  {#if !app.shopping.length}
    <div class="card empty">
      <ShoppingBasket size={40} strokeWidth={1.5} />
      <h2>Your list is empty</h2>
      <p>Add combos to your plan and the shopping list builds itself.</p>
      <button class="btn primary" onclick={() => router.go('plan')}>Go to plan</button>
    </div>
  {:else}
    <div class="toolbar row wrap">
      <div class="progress" aria-label="{done} of {toBuy.length} items in cart">
        <div class="bar"><div style:width="{toBuy.length ? (done / toBuy.length) * 100 : 0}%"></div></div>
        <span class="small num"><strong>{done}</strong> of {toBuy.length} in cart</span>
      </div>
      <span class="spacer"></span>
      {#if done}<button class="btn sm ghost" onclick={resetChecks}><RotateCcw size={14} /> Uncheck all</button>{/if}
      <button class="btn sm" onclick={copyText}><ClipboardCopy size={14} /> Copy</button>
    </div>

    {#each groups as [aisle, items] (aisle)}
      <section class="aisle">
        <h2 class="section-title">{aisleLabel(aisle)} <span class="tiny">· {items.length}</span></h2>
        <ul class="card items">
          {#each items as i (i.foodId)}
            {@const checked = cartSet.has(i.foodId)}
            <li class:checked>
              <label class="item">
                <input type="checkbox" {checked} onchange={() => app.toggle('inCart', i.foodId)} />
                <span class="box" aria-hidden="true">{#if checked}<Check size={14} strokeWidth={3} />{/if}</span>
                <span class="text">
                  <span class="nm">{i.name}</span>
                  <span class="tiny muted">uses {i.need} · {i.usedBy.join(', ')}</span>
                </span>
                <span class="buy num">{i.buy}</span>
              </label>
              <button class="btn icon sm ghost" title="I already have this" aria-label="I already have {i.name}" onclick={() => markHave(i)}>
                <House size={15} />
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}

    {#if have.length}
      <section class="aisle">
        <button class="section-title linkish" aria-expanded={showHave} onclick={() => (showHave = !showHave)}>
          <House size={14} /> Already have · {have.length}
          <span class="tiny" style:text-transform="none">{showHave ? 'hide' : 'show'}</span>
        </button>
        {#if showHave}
          <ul class="card items have">
            {#each have as i (i.foodId)}
              <li>
                <div class="item">
                  <span class="text">
                    <span class="nm">{i.name}</span>
                    <span class="tiny muted">uses {i.need}</span>
                  </span>
                </div>
                <button class="btn sm ghost" onclick={() => app.toggle('have', i.foodId)}><Undo2 size={14} /> Need to buy</button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  {/if}
</div>


<style>
  .toolbar {
    position: sticky;
    top: calc(57px + env(safe-area-inset-top, 0px));
    z-index: 5;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(8px);
    padding: 0.6rem 0;
    margin: -0.6rem 0;
  }
  @media (min-width: 900px) {
    .toolbar {
      top: 0;
    }
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 140px;
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
  .aisle {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  .items li {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding-right: 0.4rem;
    border-bottom: 1px solid var(--line);
  }
  .items li:last-child {
    border-bottom: 0;
  }
  .item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.4rem 0.7rem 0.9rem;
    cursor: pointer;
    min-width: 0;
    min-height: 56px;
  }
  .item input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
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
    transition: all 0.12s;
  }
  .item:has(input:focus-visible) .box {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .checked .box {
    background: var(--accent);
    border-color: var(--accent);
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .text .tiny {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nm {
    font-weight: 600;
  }
  .nm::first-letter {
    text-transform: uppercase;
  }
  .checked .nm {
    text-decoration: line-through;
    color: var(--muted);
  }
  .buy {
    font-weight: 650;
    font-size: 0.9rem;
    text-align: right;
    white-space: nowrap;
  }
  .checked .buy {
    color: var(--muted);
  }
  .have .item {
    cursor: default;
  }
  .linkish {
    border: 0;
    background: none;
    padding: 0.25rem 0;
    cursor: pointer;
  }
</style>
