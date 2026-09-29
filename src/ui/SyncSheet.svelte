<script lang="ts">
  import { plural } from '../lib/format'
  import { periodTitle } from '../lib/period'
  import { app } from '../lib/store.svelte'
  import { buildPayload } from '../lib/sync.svelte'
  import { ui } from '../lib/ui.svelte'
  import QrShare from './QrShare.svelte'
  import Sheet from './Sheet.svelte'

  const payload = $derived(ui.syncOpen ? buildPayload() : null)
  const title = $derived(app.period ? periodTitle(app.period) : 'Meal plan')
</script>

<Sheet bind:open={ui.syncOpen} title="Sync plan to your phone" subtitle="{title} · {plural(app.menuCount, 'meal')}">
  {#if payload}
    <div class="stack" style:--gap="1rem">
      <p class="small muted">
        Scan with your phone's camera to copy this whole period to it — dates, combos, servings, portions and prep-set
        amounts. The phone then has the same plan, shopping list and prep plan, offline. Nothing is uploaded: the plan
        travels inside the link.
      </p>
      <QrShare {payload} {title} />
      <p class="tiny muted">Changed the plan later? Sync again — the phone updates this period and keeps its checkmarks.</p>
    </div>
  {:else}
    <p class="muted">Plan a period first.</p>
  {/if}
</Sheet>
