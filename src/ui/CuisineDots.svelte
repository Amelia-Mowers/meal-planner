<script lang="ts">
  import { cuisineShort } from '../lib/format'
  let { cuisines, label = false }: { cuisines: string[]; label?: boolean } = $props()
</script>

<span class="cz" title={cuisines.map(cuisineShort).join(', ')}>
  {#each cuisines as c (c)}
    <span class="dot" style:background="var(--cz-{c}, var(--cz-neutral))"></span>
  {/each}
  {#if label}<span class="tiny muted">{cuisines.map(cuisineShort).join(' · ')}</span>{/if}
</span>

<style>
  .cz {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .tiny {
    margin-left: 0.25rem;
  }
</style>
