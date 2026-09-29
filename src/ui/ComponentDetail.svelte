<script lang="ts">
  import { Check, Clock, Lock, Plus, Snowflake, Refrigerator, TriangleAlert, Wrench } from '@lucide/svelte'
  import { CUISINE_LABEL, minutes } from '../lib/format'
  import { componentNutrition } from '../lib/nutrition'
  import { app } from '../lib/store.svelte'
  import type { Component } from '../lib/types'
  import { formatQty } from '../lib/units'
  import MacroBar from './MacroBar.svelte'
  import RoleTag from './RoleTag.svelte'

  let { c }: { c: Component } = $props()
  const nut = $derived(componentNutrition(app.lib, c))
  const inSet = $derived(app.prepSetIds.has(c.id))
  const tested = $derived(app.isTested(c.id))
  const labelFoods = $derived(
    c.supplies.map((s) => app.lib.foods.get(s.foodId)).filter((f) => f && f.nutritionSource !== 'usda-sr-legacy'),
  )
  const licenseName = $derived(
    c.license?.includes('publicdomain/zero') ? 'CC0 1.0' : c.license?.includes('by-sa') ? 'CC BY-SA' : c.license?.includes('/by/') ? 'CC BY' : c.license,
  )
</script>

<div class="stack" style:--gap="1.25rem">
  <div class="stack" style:--gap=".5rem">
    <div class="row wrap">
      <RoleTag role={c.role} />
      {#each c.cuisines as cz (cz)}<span class="badge">{CUISINE_LABEL[cz] ?? cz}</span>{/each}
      {#each c.formats as f (f)}<span class="badge">{f}</span>{/each}
      {#if c.source === 'private'}<span class="badge accent"><Lock size={11} /> Private</span>{/if}
      {#if tested}<span class="badge ok"><Check size={11} /> Tested</span>{/if}
    </div>
    {#if c.description}<p class="muted">{c.description}</p>{/if}
  </div>

  <div class="card pad">
    <div class="row" style:margin-bottom=".6rem">
      <h3>Per portion</h3>
      <span class="muted small">· {formatQty(c.portion)}</span>
    </div>
    <MacroBar n={nut.n} targets={app.targets} approximate={nut.approximate} />
    {#if labelFoods.length}
      <p class="tiny muted" style:margin-top=".6rem">
        ≈ Uses label values for {labelFoods.map((f) => f!.name).join(', ')} — check your brand.
      </p>
    {/if}
  </div>

  <div class="facts">
    <div><Clock size={16} /><span>{minutes(c.prepMin)} hands-on{c.cookMin ? ` · ${minutes(c.cookMin)} cooking` : ''}</span></div>
    <div>
      <Refrigerator size={16} /><span>{c.fridgeDays == null ? 'Shelf-stable' : `Keeps ${c.fridgeDays} days`}</span>
    </div>
    <div><Snowflake size={16} /><span>{c.freezable ? 'Freezes well' : "Don't freeze"}</span></div>
    {#if c.tools.length}<div><Wrench size={16} /><span>{c.tools.join(', ')}</span></div>{/if}
  </div>

  <section class="stack" style:--gap=".5rem">
    <h3>Ingredients <span class="muted small">· makes {formatQty(c.yield)}</span></h3>
    <ul class="ing">
      {#each c.supplies as s, i (i)}
        {@const food = app.lib.foods.get(s.foodId)}
        <li>
          <span class="amt num">{formatQty(s.qty)}</span>
          <span>{food?.name ?? s.foodId}{#if s.description}<span class="muted">, {s.description}</span>{/if}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="stack" style:--gap=".5rem">
    <h3>Steps</h3>
    <ol class="steps">
      {#each c.steps as step, i (i)}<li>{step}</li>{/each}
    </ol>
  </section>

  {#if c.needsReview}
    {@const notes = (c.doc['mp:reviewNotes'] as string[] | undefined) ?? []}
    <div class="callout">
      <TriangleAlert size={18} />
      <div>
        <p>Flagged for review: some quantities or nutrition values are estimates.</p>
        {#if notes.length}<ul class="small">{#each notes as n (n)}<li>{n}</li>{/each}</ul>{/if}
      </div>
    </div>
  {/if}

  <section class="prov small muted">
    {#if c.author}<div>By {c.author}</div>{/if}
    {#if c.license}<div>License: <a href={c.license} target="_blank" rel="noopener">{licenseName}</a></div>{/if}
    {#if c.isBasedOn}<div>Based on: {c.isBasedOn}</div>{/if}
    <div class="mono">{c.id}</div>
  </section>

  <div class="row wrap">
    <button class="btn" class:primary={!inSet} onclick={() => app.toggleInSet(c.id)}>
      {#if inSet}<Check size={16} /> In prep set{:else}<Plus size={16} /> Add to prep set{/if}
    </button>
    <label class="row small tested">
      <input type="checkbox" checked={tested} onchange={() => (app.tested = { ...app.tested, [c.id]: !tested })} />
      I've made this and it works
    </label>
  </div>
</div>

<style>
  .pad {
    padding: 1rem;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem 1rem;
    font-size: 0.9rem;
    color: var(--ink-2);
  }
  .facts div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ing {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.35rem;
  }
  .ing li {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
    gap: 0.5rem;
    padding: 0.35rem 0;
    border-bottom: 1px dashed var(--line);
  }
  .amt {
    font-weight: 650;
  }
  .steps {
    margin: 0;
    padding-left: 1.25rem;
    display: grid;
    gap: 0.5rem;
  }
  .steps li::marker {
    font-weight: 700;
    color: var(--accent);
  }
  .prov {
    display: grid;
    gap: 0.15rem;
  }
  .mono {
    font-family: var(--mono);
    font-size: 0.75rem;
  }
  .tested {
    gap: 0.45rem;
    cursor: pointer;
    min-height: 40px;
  }
</style>
