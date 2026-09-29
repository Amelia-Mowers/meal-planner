<script lang="ts">
  import { History, Repeat, Sparkles } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import { plural } from '../lib/format'
  import { LENGTH_PRESETS, mealsTarget, newPeriod, peopleOf, periodTitle, rangeLabel, servingWord, type Period } from '../lib/period'
  import { app, type PastPeriod } from '../lib/store.svelte'
  import { toasts } from '../lib/toast.svelte'
  import { ui } from '../lib/ui.svelte'
  import Sheet from './Sheet.svelte'
  import Stepper from './Stepper.svelte'

  const mode = $derived(ui.periodSheet)
  let open = $state(false)
  $effect(() => {
    open = ui.periodSheet !== null
  })
  $effect(() => {
    if (!open) ui.periodSheet = null
  })

  // Draft — re-seeded whenever the sheet opens.
  let draft = $state<Period>(newPeriod())
  let customDays = $state(false)
  let startWith = $state<'empty' | 'repeat' | number>('empty')
  $effect(() => {
    const m = ui.periodSheet
    untrack(() => {
      if (m === 'edit' && app.period) draft = { ...$state.snapshot(app.period) }
      else if (m === 'new') {
        draft = app.nextPeriodDraft()
        startWith = 'empty'
      }
      customDays = !LENGTH_PRESETS.some((p) => p.days === draft.days)
    })
  })

  const hasCurrent = $derived(!!app.period && app.menu.length > 0)
  const past = $derived(app.history.filter((h) => h.period.id !== app.period?.id))

  function save() {
    const days = Math.max(1, Math.min(31, Math.round(draft.days)))
    const p: Period = { ...draft, days, people: peopleOf(draft), name: draft.name?.trim() || undefined }
    if (mode === 'edit' && app.period) {
      app.period = p
      toasts.show('Period updated')
    } else {
      const from: PastPeriod | null =
        startWith === 'repeat' ? app.snapshot() : typeof startWith === 'number' ? past[startWith] : null
      const prev = app.snapshot()
      app.startPeriod({ ...p, id: newPeriod().id }, from)
      toasts.show(`Started ${periodTitle(p)}`, prev ? { action: () => app.startPeriod(prev.period, prev), actionLabel: 'Undo' } : {})
    }
    open = false
  }
</script>

<Sheet
  bind:open
  title={mode === 'edit' ? 'Edit period' : app.period ? 'New period' : 'Plan a period'}
  subtitle={mode === 'new' && app.period ? `${periodTitle(app.period)} will be saved to your history.` : undefined}
>
  <div class="stack" style:--gap="1.25rem">
    <div class="field">
      <span class="label">Length</span>
      <div class="row wrap" role="group" aria-label="Length">
        {#each LENGTH_PRESETS as p (p.days)}
          <button
            class="chip"
            aria-pressed={!customDays && draft.days === p.days}
            onclick={() => {
              customDays = false
              draft.days = p.days
            }}>{p.label}</button
          >
        {/each}
        <button class="chip" aria-pressed={customDays} onclick={() => (customDays = true)}>Custom</button>
        {#if customDays}
          <label class="row small">
            <input class="input num days" type="number" min="1" max="31" bind:value={draft.days} aria-label="Number of days" /> days
          </label>
        {/if}
      </div>
    </div>

    <div class="field">
      <span class="label">Prepped meals per day</span>
      <div class="row wrap" role="group" aria-label="Meals per day">
        {#each [[1, 'Lunch or dinner'], [2, 'Lunch & dinner'], [3, 'Three meals']] as [n, l] (n)}
          <button class="chip" aria-pressed={draft.mealsPerDay === n} onclick={() => (draft.mealsPerDay = n as number)}>
            <strong>{n}</strong>
            {l}
          </button>
        {/each}
      </div>
    </div>

    <div class="field">
      <span class="label" id="people-label">People eating</span>
      <div class="row">
        <Stepper
          value={draft.people ?? 1}
          min={1}
          max={12}
          size="md"
          format={(v) => (v === 1 ? 'Just me' : `${v} people`)}
          onchange={(v) => (draft.people = v)}
          label="number of people"
        />
        <span class="small muted">Every meal is cooked for everyone.</span>
      </div>
    </div>

    <div class="grid2">
      <div class="field">
        <label for="p-start">Starts</label>
        <input id="p-start" class="input" type="date" bind:value={draft.start} />
      </div>
      <div class="field">
        <label for="p-name">Name <span class="muted">(optional)</span></label>
        <input id="p-name" class="input" type="text" placeholder={periodTitle({ ...draft, name: undefined })} bind:value={draft.name} />
      </div>
    </div>

    {#if mode === 'new' && (hasCurrent || past.length)}
      <div class="field">
        <span class="label">Start with</span>
        <div class="options">
          <label class="opt" class:on={startWith === 'empty'}>
            <input type="radio" name="start-with" checked={startWith === 'empty'} onchange={() => (startWith = 'empty')} />
            <Sparkles size={16} /> <span>A blank plan</span>
          </label>
          {#if hasCurrent}
            <label class="opt" class:on={startWith === 'repeat'}>
              <input type="radio" name="start-with" checked={startWith === 'repeat'} onchange={() => (startWith = 'repeat')} />
              <Repeat size={16} />
              <span>Repeat this period <span class="muted small">· {plural(app.menuCount, 'meal')}</span></span>
            </label>
          {/if}
          {#each past.slice(0, 5) as h, i (h.period.id)}
            <label class="opt" class:on={startWith === i}>
              <input type="radio" name="start-with" checked={startWith === i} onchange={() => (startWith = i)} />
              <History size={16} />
              <span>
                {periodTitle(h.period)}
                <span class="muted small">· {plural(h.menu.reduce((s, m) => s + m.servings, 0), 'meal')}</span>
              </span>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <p class="small muted">
      {rangeLabel({ ...draft, days: Math.max(1, draft.days || 1) })} · plan for
      <strong>{plural(mealsTarget(draft) || 0, servingWord(draft))}</strong>
      {#if peopleOf(draft) > 1}<span class="muted">({draft.days} days × {draft.mealsPerDay} a day × {peopleOf(draft)} people)</span>{/if}
    </p>
  </div>

  {#snippet footer()}
    <button class="btn ghost" onclick={() => (open = false)}>Cancel</button>
    <button class="btn primary" onclick={save}>{mode === 'edit' ? 'Save' : 'Start planning'}</button>
  {/snippet}
</Sheet>

<style>
  .days {
    width: 4.5rem;
    min-height: 34px;
    padding: 0.3rem 0.5rem;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }
  .options {
    display: grid;
    gap: 0.4rem;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 0.8rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    cursor: pointer;
    min-height: 44px;
  }
  .opt.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .opt input {
    accent-color: var(--accent);
  }
</style>
