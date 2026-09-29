<script lang="ts">
  import { ScanLine } from '@lucide/svelte'
  import { plural } from '../lib/format'
  import { periodTitle, servingWord } from '../lib/period'
  import { app } from '../lib/store.svelte'
  import { buildPayload } from '../lib/sync.svelte'
  import { ui } from '../lib/ui.svelte'
  import QrShare from './QrShare.svelte'
  import Sheet from './Sheet.svelte'

  const payload = $derived(ui.syncOpen ? buildPayload() : null)
  const title = $derived(app.period ? periodTitle(app.period) : 'Meal plan')

  function scanTheirs() {
    ui.syncOpen = false
    ui.scanOpen = true
  }
</script>

<Sheet bind:open={ui.syncOpen} title="Sync with another device" subtitle="{title} · {plural(app.menuCount, servingWord(app.period))}">
  {#if payload}
    <div class="stack" style:--gap="1rem">
      <ol class="steps small">
        <li>On the other device, open Bowl & Wrap and tap <strong>Scan</strong> (or use the camera app).</li>
        <li>Scan this code. It gets the whole period — plan, shopping and prep checkmarks — merged with anything it already has.</li>
        <li>For a two-way sync, scan that device's code back from here.</li>
      </ol>
      <QrShare {payload} {title} />
      <div class="row" style:justify-content="center">
        <button class="btn" onclick={scanTheirs}><ScanLine size={16} /> Scan the other device</button>
      </div>
      <p class="tiny muted" style:text-align="center">Nothing is uploaded — the plan travels inside the code.</p>
    </div>
  {:else}
    <p class="muted">Plan a period first.</p>
  {/if}
</Sheet>

<style>
  .steps {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.35rem;
    color: var(--ink-2);
  }
</style>
