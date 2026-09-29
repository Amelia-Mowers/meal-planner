<script lang="ts">
  import { Copy, Share2, TriangleAlert } from '@lucide/svelte'
  import QRCode from 'qrcode'
  import { encodePayload, QR_SOFT_LIMIT, type HandoffPayload } from '../lib/handoff'
  import { toasts } from '../lib/toast.svelte'

  let { payload }: { payload: HandoffPayload } = $props()

  let svg = $state('')
  let url = $state('')
  let size = $state(0)
  let error = $state('')

  $effect(() => {
    const p = payload
    let cancelled = false
    ;(async () => {
      try {
        const frag = await encodePayload(p)
        const prefix = `${location.origin}${location.pathname}#p=`
        if (cancelled) return
        url = prefix + frag
        size = url.length
        // Byte mode for the URL prefix (lowercase), alphanumeric mode for the Base45 payload.
        svg = await QRCode.toString(
          [
            { data: new TextEncoder().encode(prefix), mode: 'byte' },
            { data: frag, mode: 'alphanumeric' },
          ],
          { type: 'svg', errorCorrectionLevel: 'L', margin: 2, color: { dark: '#111111', light: '#ffffff' } },
        )
        error = ''
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }
    })()
    return () => (cancelled = true)
  })

  async function copy() {
    await navigator.clipboard.writeText(url)
    toasts.show('Link copied')
  }
  async function share() {
    await navigator.share?.({ title: 'Shopping list', url }).catch(() => {})
  }
</script>

<div class="stack" style:--gap="1rem">
  <p class="muted small">
    Scan with your phone's camera to open this list there — it works offline once opened, and nothing is uploaded: the whole
    list lives in the link.
  </p>
  {#if error}
    <div class="callout"><TriangleAlert size={18} /> Couldn't build the QR code: {error}</div>
  {:else if svg}
    <div class="qr" role="img" aria-label="QR code linking to the shopping list">{@html svg}</div>
    <div class="row small muted" style:justify-content="center">
      <span class="num">{size} characters</span>
      {#if size > QR_SOFT_LIMIT}
        <span class="badge warn" title="Larger codes are harder to scan off a screen">Dense — hold steady</span>
      {/if}
    </div>
  {:else}
    <div class="qr skeleton" aria-busy="true"></div>
  {/if}
  <div class="row wrap" style:justify-content="center">
    <button class="btn" onclick={copy} disabled={!url}><Copy size={16} /> Copy link</button>
    {#if 'share' in navigator}
      <button class="btn" onclick={share} disabled={!url}><Share2 size={16} /> Share…</button>
    {/if}
  </div>
</div>

<style>
  .qr {
    width: min(100%, 340px);
    aspect-ratio: 1;
    margin: 0 auto;
    background: #fff;
    border-radius: 16px;
    padding: 8px;
    box-shadow: var(--shadow-1);
    border: 1px solid var(--line);
  }
  .qr :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
  .skeleton {
    background: var(--surface-2);
    animation: pulse 1.2s infinite ease-in-out;
  }
  @keyframes pulse {
    50% {
      opacity: 0.5;
    }
  }
</style>
