<script lang="ts">
  import { Check, Recycle } from '@lucide/svelte'
  import { genId, nutritionOf, resolveCombo, sharedProfile } from '../lib/combos'
  import { ROLE_PLURAL } from '../lib/format'
  import { app } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import { ROLES, type Component, type Format, type Role } from '../lib/types'
  import { ui } from '../lib/ui.svelte'
  import CuisineDots from './CuisineDots.svelte'
  import MacroBar from './MacroBar.svelte'
  import Sheet from './Sheet.svelte'
  import Stepper from './Stepper.svelte'
  import TargetBadge from './TargetBadge.svelte'

  const MAX_VEG = 4
  const MULTI: Partial<Record<Role, number>> = { veg: MAX_VEG, protein: 2 }
  const REQUIRED: Role[] = ['base', 'protein', 'veg', 'sauce']

  let format = $state<Format>('bowl')
  let picks = $state<Record<Role, string[]>>({ base: [], protein: [], veg: [], sauce: [], topper: [] })
  let servings = $state(2)
  $effect(() => {
    if (ui.builderOpen) servings = app.defaultServings
  })

  const all = $derived([...app.lib.components.values()].filter((c) => !app.onlyTested || app.isTested(c.id)))
  const chosen = $derived(ROLES.flatMap((r) => picks[r]).map((id) => app.lib.components.get(id)!).filter(Boolean))
  const ready = $derived(REQUIRED.every((r) => picks[r].length > 0))
  const parts = $derived(chosen.map((c) => ({ componentId: c.id })))
  const combo = $derived(ready ? resolveCombo(app.lib, genId(format, parts)) : null)
  const nut = $derived(nutritionOf(app.lib, { id: 'draft', name: '', description: '', format, cuisine: 'neutral', parts, curated: false, tested: false, source: 'bundled' }))

  /** Would adding c keep the combo's flavors compatible and fit the format? */
  function fits(c: Component): boolean {
    if (!c.formats.includes(format)) return false
    const others = chosen.filter((x) => x.role !== c.role || MULTI[c.role])
    return sharedProfile([...others, c]) !== null
  }
  function toggle(c: Component) {
    const cur = picks[c.role]
    if (cur.includes(c.id)) picks[c.role] = cur.filter((x) => x !== c.id)
    else if (MULTI[c.role]) picks[c.role] = cur.length >= MULTI[c.role]! ? cur : [...cur, c.id]
    else picks[c.role] = [c.id]
  }
  function setFormat(f: Format) {
    format = f
    for (const r of ROLES) picks[r] = picks[r].filter((id) => app.lib.components.get(id)?.formats.includes(f))
  }
  function add() {
    if (!combo) return
    app.setServings(combo.id, app.servingsOf(combo.id) + servings)
    toasts.show(`Added ${servings} × ${combo.name}`)
    picks = { base: [], protein: [], veg: [], sauce: [], topper: [] }
    ui.builderOpen = false
  }
  const hint: Record<Role, string> = {
    base: 'pick one',
    protein: 'one, or two to pair a main with beans or eggs',
    veg: `up to ${MAX_VEG}`,
    sauce: 'pick one — it sets the flavor',
    topper: 'optional',
  }
</script>

<Sheet bind:open={ui.builderOpen} title="Build a combo" subtitle="Mix and match components. Options that clash with your picks are hidden." wide>
  <div class="stack" style:--gap="1.1rem">
    <div class="segmented" role="group" aria-label="Format">
      <button aria-pressed={format === 'bowl'} onclick={() => setFormat('bowl')}>Bowl</button>
      <button aria-pressed={format === 'wrap'} onclick={() => setFormat('wrap')}>Wrap</button>
    </div>

    {#each ROLES as r (r)}
      {@const options = all.filter((c) => c.role === r && (picks[r].includes(c.id) || fits(c)))}
      <section class="stack" style:--gap=".45rem">
        <h3 class="section-title">
          <span class="dot" style:background="var(--role-{r})"></span>
          {ROLE_PLURAL[r]} <span class="tiny" style:text-transform="none" style:letter-spacing="0">· {hint[r]}</span>
        </h3>
        <div class="row wrap opts">
          {#each options as c (c.id)}
            {@const on = picks[r].includes(c.id)}
            <button class="chip pick" aria-pressed={on} style:--c="var(--role-{r})" onclick={() => toggle(c)}>
              {#if on}<Check size={13} strokeWidth={3} />{:else if app.prepSetIds.has(c.id)}<Recycle size={13} />{/if}
              {c.name}
              <CuisineDots cuisines={c.cuisines} />
            </button>
          {:else}
            <span class="small muted">Nothing fits your current picks.</span>
          {/each}
        </div>
      </section>
    {/each}

    <p class="tiny muted"><Recycle size={11} /> = already in this period's prep set</p>
  </div>

  {#snippet footer()}
    <div class="summary">
      {#if chosen.length}
        <div class="row">
          <strong class="nm">{combo?.name ?? 'Your combo'}</strong>
          <span class="spacer"></span>
          {#if ready}<TargetBadge n={nut.n} targets={app.targets} />{/if}
        </div>
        <MacroBar n={nut.n} targets={app.targets} approximate={nut.approximate} />
      {:else}
        <span class="small muted">Pick a base, protein, veg and sauce.</span>
      {/if}
    </div>
    <div class="row">
      <Stepper value={servings} min={1} onchange={(v) => (servings = v)} label="servings" />
      <button class="btn primary" disabled={!ready} onclick={add}>Add to plan</button>
    </div>
  {/snippet}
</Sheet>

<style>
  .opts {
    gap: 0.35rem;
  }
  .pick[aria-pressed='true'] {
    background: color-mix(in srgb, var(--c) 16%, var(--surface));
    color: var(--ink);
    border-color: var(--c);
  }
  .summary {
    flex: 1 1 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .nm {
    min-width: 0;
  }
</style>
