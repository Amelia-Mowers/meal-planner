import { readFragment } from './handoff'

export type Route = 'plan' | 'combos' | 'shop' | 'prep' | 'library' | 'settings' | 'sync'
const ROUTES: Route[] = ['plan', 'combos', 'shop', 'prep', 'library', 'settings']

class Router {
  route = $state<Route>('plan')
  /** Base45 payload when opened from a sync QR code. */
  shared = $state<string | null>(null)

  constructor() {
    this.sync()
    window.addEventListener('hashchange', () => this.sync())
  }

  private sync() {
    const frag = readFragment(location.hash)
    if (frag) {
      this.shared = frag
      this.route = 'sync'
      return
    }
    const r = location.hash.replace(/^#\/?/, '').split('/')[0] as Route
    this.route = ROUTES.includes(r) ? r : 'plan'
  }

  go(r: Route) {
    this.route = r
    if (location.hash !== `#/${r}`) location.hash = `/${r}`
    window.scrollTo({ top: 0 })
  }
}

export const router = new Router()
