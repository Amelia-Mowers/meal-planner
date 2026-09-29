<script lang="ts">
  import {
    CalendarDays,
    ChefHat,
    Library as LibraryIcon,
    QrCode,
    RefreshCw,
    ScanLine,
    Settings,
    ShoppingBasket,
    Sparkles,
    WifiOff,
  } from '@lucide/svelte'
  import { useRegisterSW } from 'virtual:pwa-register/svelte'
  import { partsNutrition } from './lib/nutrition'
  import { router, type Route } from './lib/router.svelte'
  import { app } from './lib/store.svelte'
  import { toasts } from './lib/toast.svelte'
  import { ui } from './lib/ui.svelte'
  import ComboBuilder from './ui/ComboBuilder.svelte'
  import ComboCard from './ui/ComboCard.svelte'
  import ComponentDetail from './ui/ComponentDetail.svelte'
  import ExtraPicker from './ui/ExtraPicker.svelte'
  import PeriodSheet from './ui/PeriodSheet.svelte'
  import ScanSheet from './ui/ScanSheet.svelte'
  import Sheet from './ui/Sheet.svelte'
  import SyncSheet from './ui/SyncSheet.svelte'
  import Toasts from './ui/Toasts.svelte'
  import CombosView from './views/CombosView.svelte'
  import LibraryView from './views/LibraryView.svelte'
  import PlanView from './views/PlanView.svelte'
  import PrepView from './views/PrepView.svelte'
  import SettingsView from './views/SettingsView.svelte'
  import ShopView from './views/ShopView.svelte'
  import SyncView from './views/SyncView.svelte'

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onOfflineReady: () => toasts.show('Ready to work offline'),
  })

  const NAV: { route: Route; label: string; icon: typeof CalendarDays; mobile: boolean }[] = [
    { route: 'plan', label: 'Plan', icon: CalendarDays, mobile: true },
    { route: 'combos', label: 'Combos', icon: Sparkles, mobile: true },
    { route: 'shop', label: 'Shop', icon: ShoppingBasket, mobile: true },
    { route: 'prep', label: 'Prep', icon: ChefHat, mobile: true },
    { route: 'library', label: 'Library', icon: LibraryIcon, mobile: true },
    { route: 'settings', label: 'Settings', icon: Settings, mobile: false },
  ]

  let online = $state(navigator.onLine)
  $effect(() => {
    const on = () => (online = true)
    const off = () => (online = false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
    }
  })

  const detailComp = $derived(ui.detail ? app.lib.components.get(ui.detail) : undefined)
  const detailCombo = $derived(ui.detail ? app.lib.combos.get(ui.detail) : undefined)
  let detailOpen = $state(false)
  $effect(() => {
    detailOpen = !!ui.detail
  })
  $effect(() => {
    if (!detailOpen) ui.detail = null
  })

  const badge = (r: Route) =>
    r === 'plan' ? app.menuCount : r === 'shop' ? app.shopping.filter((i) => !app.have.includes(i.foodId) && !app.inCart.includes(i.foodId)).length : 0
</script>

<div class="shell" class:shared={router.route === 'sync'}>
  <aside class="side">
    <a class="brand" href="#/plan">
      <img src="{import.meta.env.BASE_URL}icon.svg" alt="" width="32" height="32" />
      <span>Bowl &amp; Wrap</span>
    </a>
    <nav aria-label="Main">
      {#each NAV as n (n.route)}
        <a href="#/{n.route}" class="navlink" aria-current={router.route === n.route ? 'page' : undefined}>
          <n.icon size={18} />
          <span>{n.label}</span>
          {#if badge(n.route)}<span class="count num">{badge(n.route)}</span>{/if}
        </a>
      {/each}
    </nav>
    <div class="side-actions">
      <button class="btn sm" onclick={() => (ui.scanOpen = true)}><ScanLine size={16} /> Scan</button>
      {#if app.period}<button class="btn sm" onclick={() => (ui.syncOpen = true)}><QrCode size={16} /> My code</button>{/if}
    </div>
    <p class="tiny muted side-foot">Offline-ready · data stays on this device</p>
  </aside>

  <header class="topbar">
    <a class="brand" href="#/plan">
      <img src="{import.meta.env.BASE_URL}icon.svg" alt="" width="28" height="28" />
      <span>Bowl &amp; Wrap</span>
    </a>
    <span class="spacer"></span>
    {#if !online}<span class="badge" title="You're offline — everything still works"><WifiOff size={12} /> Offline</span>{/if}
    <button class="btn sm ghost scan" onclick={() => (ui.scanOpen = true)} aria-label="Scan a plan from another device"><ScanLine size={18} /> Scan</button>
    <a class="btn icon ghost" href="#/settings" aria-label="Settings" aria-current={router.route === 'settings' ? 'page' : undefined}><Settings size={20} /></a>
  </header>

  <main>
    {#if !app.ready}
      <div class="page"><p class="muted">Loading…</p></div>
    {:else if router.route === 'sync'}
      <SyncView />
    {:else if router.route === 'plan'}
      <PlanView />
    {:else if router.route === 'combos'}
      <CombosView />
    {:else if router.route === 'shop'}
      <ShopView />
    {:else if router.route === 'prep'}
      <PrepView />
    {:else if router.route === 'library'}
      <LibraryView />
    {:else if router.route === 'settings'}
      <SettingsView />
    {/if}
  </main>

  <nav class="tabbar" aria-label="Main">
    {#each NAV.filter((n) => n.mobile) as n (n.route)}
      <a href="#/{n.route}" class="tab" aria-current={router.route === n.route ? 'page' : undefined}>
        <span class="ic">
          <n.icon size={22} />
          {#if badge(n.route)}<span class="pip num">{badge(n.route)}</span>{/if}
        </span>
        <span class="lbl">{n.label}</span>
      </a>
    {/each}
  </nav>
</div>

{#if detailComp}
  <Sheet bind:open={detailOpen} title={detailComp.name} wide>
    <ComponentDetail c={detailComp} />
  </Sheet>
{:else if detailCombo}
  {@const n = partsNutrition(app.lib, detailCombo.parts).n}
  <Sheet bind:open={detailOpen} title={detailCombo.name} subtitle="{Math.round(n.kcal)} kcal · {Math.round(n.protein)} g protein" wide>
    <div class="stack">
      <ComboCard combo={detailCombo} />
      <label class="row small" style:gap=".45rem">
        <input
          type="checkbox"
          checked={app.isTested(detailCombo.id)}
          onchange={() => (app.tested = { ...app.tested, [detailCombo.id]: !app.isTested(detailCombo.id) })}
        />
        I've made this combo and it works
      </label>
      <p class="tiny muted">By {detailCombo.doc?.author?.name ?? 'unknown'} · <span class="mono">{detailCombo.id}</span></p>
    </div>
  </Sheet>
{/if}

{#if $needRefresh}
  <div class="update card" role="alert">
    <RefreshCw size={16} />
    <span class="small">A new version is available.</span>
    <button class="btn sm primary" onclick={() => updateServiceWorker(true)}>Reload</button>
    <button class="btn sm ghost" onclick={() => needRefresh.set(false)}>Later</button>
  </div>
{/if}

<PeriodSheet />
<ComboBuilder />
<ExtraPicker />
<SyncSheet />
<ScanSheet />
<Toasts />

<style>
  .shell {
    min-height: 100dvh;
  }
  .side {
    display: none;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--ink);
    text-decoration: none;
    font-size: 1.05rem;
  }
  .brand img {
    border-radius: 8px;
  }
  .topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    padding-top: calc(0.5rem + env(safe-area-inset-top, 0px));
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .topbar a[aria-current='page'] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: calc(var(--nav-h) + var(--safe-b));
    padding-bottom: var(--safe-b);
    background: color-mix(in srgb, var(--surface) 94%, transparent);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--line);
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.7rem;
    font-weight: 650;
  }
  .tab .ic {
    position: relative;
    display: grid;
    place-items: center;
    width: 56px;
    height: 30px;
    border-radius: 999px;
    transition: background 0.15s;
  }
  .tab[aria-current='page'] {
    color: var(--accent);
  }
  .tab[aria-current='page'] .ic {
    background: var(--accent-soft);
  }
  .pip {
    position: absolute;
    top: -3px;
    right: 6px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 0.65rem;
    font-weight: 800;
    display: grid;
    place-items: center;
    border: 2px solid var(--surface);
  }
  .shared .tabbar {
    display: none;
  }

  @media (min-width: 900px) {
    .shell {
      display: grid;
      grid-template-columns: 240px 1fr;
    }
    .topbar,
    .tabbar {
      display: none;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      position: sticky;
      top: 0;
      height: 100dvh;
      padding: 1.25rem 0.9rem;
      border-right: 1px solid var(--line);
      background: var(--surface);
    }
    .side .brand {
      padding: 0.25rem 0.5rem;
    }
    .side nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .navlink {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.6rem 0.75rem;
      border-radius: 10px;
      color: var(--ink-2);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .navlink:hover {
      background: var(--surface-2);
    }
    .navlink[aria-current='page'] {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .count {
      margin-left: auto;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--muted);
    }
    .side-actions {
      margin-top: auto;
      display: flex;
      gap: 0.4rem;
      padding: 0 0.25rem;
    }
    .side-foot {
      padding: 0 0.5rem;
    }
  }
  .update {
    position: fixed;
    top: 0.75rem;
    left: 50%;
    translate: -50% 0;
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.5rem 0.5rem 0.9rem;
    box-shadow: var(--shadow-2);
    width: max-content;
    max-width: calc(100vw - 2rem);
  }
  .mono {
    font-family: var(--mono);
  }
</style>
