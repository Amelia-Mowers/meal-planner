<script lang="ts">
  import { toasts } from '../lib/toast.svelte'
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts.items as t (t.id)}
    <div class="toast">
      <span>{t.message}</span>
      {#if t.action}
        <button
          class="btn sm ghost"
          onclick={() => {
            t.action?.()
            toasts.dismiss(t.id)
          }}>{t.actionLabel ?? 'Undo'}</button
        >
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    translate: -50% 0;
    bottom: calc(var(--nav-h) + var(--safe-b) + 1rem);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 100;
    width: min(460px, calc(100vw - 2rem));
    pointer-events: none;
  }
  @media (min-width: 900px) {
    .toasts {
      bottom: 1.5rem;
    }
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: space-between;
    background: var(--ink);
    color: var(--bg);
    padding: 0.6rem 0.6rem 0.6rem 1rem;
    border-radius: 12px;
    box-shadow: var(--shadow-2);
    font-size: 0.9rem;
    animation: in 0.2s ease-out;
  }
  .toast .btn {
    color: var(--bg);
    font-weight: 700;
  }
  .toast .btn:hover {
    background: rgb(255 255 255 / 0.12);
  }
  @keyframes in {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }
</style>
