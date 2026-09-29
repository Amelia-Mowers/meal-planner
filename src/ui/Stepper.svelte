<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte'

  let {
    value,
    onchange,
    min = 0,
    max = 42,
    step = 1,
    label,
    format = (v: number) => String(v),
    size = 'sm',
  }: {
    value: number
    onchange: (v: number) => void
    min?: number
    max?: number
    step?: number
    label: string
    format?: (v: number) => string
    size?: 'sm' | 'md'
  } = $props()

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
</script>

<div class="stepper {size}" role="group" aria-label={label}>
  <button class="btn icon sm ghost" onclick={() => onchange(clamp(value - step))} disabled={value <= min} aria-label="Decrease {label}">
    <Minus size={16} />
  </button>
  <output class="num" aria-live="polite">{format(value)}</output>
  <button class="btn icon sm ghost" onclick={() => onchange(clamp(value + step))} disabled={value >= max} aria-label="Increase {label}">
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
    flex: none;
  }
  output {
    min-width: 1.75rem;
    text-align: center;
    font-weight: 700;
    white-space: nowrap;
  }
  .md output {
    min-width: 2.75rem;
  }
</style>
