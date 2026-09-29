<script lang="ts">
  import { targetStatus } from '../lib/nutrition'
  import type { Nutrients, Targets } from '../lib/types'
  import { Check } from '@lucide/svelte'

  let { n, targets }: { n: Nutrients; targets: Targets } = $props()
  const status = $derived(targetStatus(n, targets))
  const diff = $derived(Math.round(n.kcal - targets.kcal))
</script>

{#if status === 'hit'}
  <span class="badge ok" title="Within ±{Math.round(targets.tolerance * 100)}% of {targets.kcal} kcal with ≥{targets.protein} g protein">
    <Check size={12} strokeWidth={3} /> On target
  </span>
{:else if status === 'low-protein'}
  <span class="badge warn" title="Calories on target, protein below {targets.protein} g">Low protein</span>
{:else if status === 'over'}
  <span class="badge bad" title="More than {Math.round(targets.tolerance * 100)}% above {targets.kcal} kcal">+{diff} kcal</span>
{:else}
  <span class="badge warn" title="More than {Math.round(targets.tolerance * 100)}% below {targets.kcal} kcal">{diff} kcal</span>
{/if}
