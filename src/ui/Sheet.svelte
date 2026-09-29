<script lang="ts">
  import { X } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  let {
    open = $bindable(false),
    title,
    subtitle,
    wide = false,
    children,
    footer,
  }: { open: boolean; title: string; subtitle?: string; wide?: boolean; children: Snippet; footer?: Snippet } = $props()

  let dialog: HTMLDialogElement | undefined = $state()

  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  })
</script>

<dialog
  bind:this={dialog}
  class:wide
  onclose={() => (open = false)}
  onclick={(e) => e.target === dialog && (open = false)}
  aria-labelledby="sheet-title"
>
  {#if open}
    <div class="sheet">
      <header>
        <div class="grip" aria-hidden="true"></div>
        <div class="titles">
          <h2 id="sheet-title">{title}</h2>
          {#if subtitle}<p class="muted small">{subtitle}</p>{/if}
        </div>
        <button class="btn icon ghost" onclick={() => (open = false)} aria-label="Close"><X size={20} /></button>
      </header>
      <div class="body">{@render children()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    padding: 0;
    border: 0;
    background: transparent;
    max-width: 100vw;
    max-height: 100dvh;
    width: 100%;
    margin: auto auto 0;
    color: var(--ink);
  }
  dialog::backdrop {
    background: rgb(10 15 12 / 0.45);
    backdrop-filter: blur(2px);
  }
  dialog[open] .sheet {
    animation: up 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .sheet {
    background: var(--surface);
    border-radius: 20px 20px 0 0;
    box-shadow: var(--shadow-3);
    max-height: 92dvh;
    display: flex;
    flex-direction: column;
    padding-bottom: var(--safe-b);
  }
  header {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.1rem 0.75rem 0.75rem 1.25rem;
    border-bottom: 1px solid var(--line);
  }
  .grip {
    position: absolute;
    top: 6px;
    left: 50%;
    translate: -50% 0;
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
  }
  .titles {
    flex: 1;
    padding-top: 0.35rem;
    min-width: 0;
  }
  .body {
    overflow-y: auto;
    padding: 1rem 1.25rem 1.25rem;
    overscroll-behavior: contain;
  }
  footer {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-wrap: wrap;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--line);
  }
  @media (min-width: 700px) {
    dialog {
      width: min(560px, calc(100vw - 2rem));
      margin: auto;
    }
    dialog.wide {
      width: min(760px, calc(100vw - 2rem));
    }
    .sheet {
      border-radius: 20px;
      max-height: 86dvh;
    }
    .grip {
      display: none;
    }
    dialog[open] .sheet {
      animation: pop 0.18s ease-out;
    }
  }
  @keyframes up {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: scale(0.97);
      opacity: 0;
    }
  }
</style>
