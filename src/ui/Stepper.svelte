<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte'

  let {
    value,
    onchange,
    min = 0,
    max = 21,
    label,
  }: { value: number; onchange: (v: number) => void; min?: number; max?: number; label: string } = $props()
</script>

<div class="stepper" role="group" aria-label={label}>
  <button class="btn icon sm ghost" onclick={() => onchange(value - 1)} disabled={value <= min} aria-label="Decrease {label}">
    <Minus size={16} />
  </button>
  <output class="num" aria-live="polite">{value}</output>
  <button class="btn icon sm ghost" onclick={() => onchange(value + 1)} disabled={value >= max} aria-label="Increase {label}">
    <Plus size={16} />
  </button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    padding: 3px;
  }
  output {
    min-width: 1.75rem;
    text-align: center;
    font-weight: 700;
  }
</style>
