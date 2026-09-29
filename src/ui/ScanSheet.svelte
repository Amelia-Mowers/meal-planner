<script lang="ts">
  import { Camera, ClipboardPaste, ImageUp, TriangleAlert } from '@lucide/svelte'
  import jsQR from 'jsqr'
  import { readFragment } from '../lib/handoff'
  import { router } from '../lib/router.svelte'
  import { ui } from '../lib/ui.svelte'
  import Sheet from './Sheet.svelte'

  let video: HTMLVideoElement | undefined = $state()
  let status = $state<'starting' | 'scanning' | 'denied' | 'unavailable'>('starting')
  let message = $state('')
  let pasted = $state('')

  type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }
  const NativeDetector = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector

  /** Accept a scanned/pasted string; returns true if it was one of our sync links. */
  function accept(text: string): boolean {
    const i = text.indexOf('#')
    const frag = i >= 0 ? readFragment(text.slice(i)) : readFragment('#' + text.trim())
    if (!frag) {
      message = "That code isn't a Bowl & Wrap plan."
      return false
    }
    ui.scanOpen = false
    router.openShared(frag)
    return true
  }

  function decodeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): string | null {
    const img = ctx.getImageData(0, 0, w, h)
    return jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null
  }

  $effect(() => {
    if (!ui.scanOpen || !video) return
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const detector = NativeDetector ? new NativeDetector({ formats: ['qr_code'] }) : null
    status = 'starting'
    message = ''

    const tick = async () => {
      if (stopped || !video) return
      if (video.readyState >= 2) {
        let text: string | null = null
        if (detector) {
          text = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null
        } else {
          // Downscale for speed; QR codes survive it fine.
          const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
          canvas.width = Math.round(video.videoWidth * scale)
          canvas.height = Math.round(video.videoHeight * scale)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          text = decodeCanvas(ctx, canvas.width, canvas.height)
        }
        if (text && accept(text)) return
      }
      raf = requestAnimationFrame(tick)
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        status = 'unavailable'
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        video!.srcObject = stream
        await video!.play()
        status = 'scanning'
        tick()
      } catch (e) {
        status = e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable'
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  })

  async function fromImage(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const text = decodeCanvas(ctx, canvas.width, canvas.height)
    if (text) accept(text)
    else message = "Couldn't find a QR code in that picture."
  }
</script>

<Sheet bind:open={ui.scanOpen} title="Scan a plan" subtitle="Point your camera at the QR code on the other device.">
  <div class="stack" style:--gap="1rem">
    <div class="viewport" class:live={status === 'scanning'}>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted></video>
      {#if status === 'scanning'}
        <div class="frame" aria-hidden="true"></div>
      {:else if status === 'starting'}
        <p class="overlay"><Camera size={28} /> Starting camera…</p>
      {:else if status === 'denied'}
        <p class="overlay"><TriangleAlert size={28} /> Camera access was blocked. Allow it in your browser settings, or scan from a photo below.</p>
      {:else}
        <p class="overlay"><TriangleAlert size={28} /> No camera available. Scan from a photo or paste the link below.</p>
      {/if}
    </div>

    {#if message}<p class="callout small">{message}</p>{/if}

    <div class="row wrap alt">
      <label class="btn">
        <ImageUp size={16} /> Scan from photo
        <input type="file" accept="image/*" class="sr-only" onchange={fromImage} />
      </label>
    </div>
    <form
      class="row paste"
      onsubmit={(e) => {
        e.preventDefault()
        accept(pasted)
      }}
    >
      <label class="sr-only" for="paste-link">Paste a sync link</label>
      <input id="paste-link" class="input" type="url" placeholder="…or paste a sync link" bind:value={pasted} />
      <button class="btn" type="submit" disabled={!pasted}><ClipboardPaste size={16} /> Open</button>
    </form>
  </div>
</Sheet>

<style>
  .viewport {
    position: relative;
    aspect-ratio: 1;
    width: min(100%, 380px);
    margin: 0 auto;
    border-radius: 18px;
    overflow: hidden;
    background: #111;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0;
  }
  .live video {
    opacity: 1;
  }
  .frame {
    position: absolute;
    inset: 16%;
    border-radius: 16px;
    box-shadow: 0 0 0 999px rgb(0 0 0 / 0.35);
    border: 3px solid rgb(255 255 255 / 0.9);
    animation: breathe 1.8s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      inset: 18%;
    }
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 1.5rem;
    text-align: center;
    color: #eee;
    font-size: 0.9rem;
  }
  .alt {
    justify-content: center;
  }
  label.btn {
    cursor: pointer;
  }
  label.btn:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .paste .input {
    flex: 1;
    min-width: 0;
  }
</style>
