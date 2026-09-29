<script lang="ts">
  import type { Nutrients, Targets } from '../lib/types'

  let { n, targets, approximate = false }: { n: Nutrients; targets: Targets; approximate?: boolean } = $props()

  const kcalPct = $derived(Math.min(100, (n.kcal / (targets.kcal * (1 + targets.tolerance))) * 100))
  const proteinPct = $derived(Math.min(100, (n.protein / targets.protein) * 100))
  const tolLo = $derived(((1 - targets.tolerance) / (1 + targets.tolerance)) * 100)
  const tolHi = 100
</script>

<div class="macros" aria-label="Nutrition per serving">
  <div class="stat">
    <div class="top">
      <span class="v num">{approximate ? '≈' : ''}{Math.round(n.kcal)}</span><span class="u">kcal</span>
    </div>
    <div class="track" aria-hidden="true">
      <div class="band" style:left="{tolLo}%" style:width="{tolHi - tolLo}%"></div>
      <div class="fill kcal" class:over={n.kcal > targets.kcal * (1 + targets.tolerance)} style:width="{kcalPct}%"></div>
    </div>
  </div>
  <div class="stat">
    <div class="top">
      <span class="v num">{Math.round(n.protein)}</span><span class="u">g protein</span>
    </div>
    <div class="track" aria-hidden="true">
      <div class="fill protein" class:met={n.protein >= targets.protein} style:width="{proteinPct}%"></div>
    </div>
  </div>
  <div class="minor small muted num">
    <span>{Math.round(n.carbs)}g carbs</span>
    <span>{Math.round(n.fat)}g fat</span>
    <span>{Math.round(n.fiber)}g fiber</span>
  </div>
</div>

<style>
  .macros {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 1rem;
  }
  .top {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
  }
  .v {
    font-size: 1.15rem;
    font-weight: 750;
  }
  .u {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .track {
    position: relative;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    margin-top: 4px;
    overflow: hidden;
  }
  .band {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--ok) 22%, transparent);
  }
  .fill {
    position: relative;
    height: 100%;
    border-radius: 3px;
    background: var(--ink-2);
    transition: width 0.25s ease;
  }
  .fill.kcal {
    background: var(--role-base);
  }
  .fill.kcal.over {
    background: var(--bad);
  }
  .fill.protein {
    background: var(--warn);
  }
  .fill.protein.met {
    background: var(--ok);
  }
  .minor {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.9rem;
  }
</style>
