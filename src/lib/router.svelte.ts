import { readFragment } from './handoff'

export type Route = 'set' | 'combos' | 'week' | 'shop' | 'prep' | 'library' | 'settings' | 'shared'
const ROUTES: Route[] = ['set', 'combos', 'week', 'shop', 'prep', 'library', 'settings']

class Router {
  route = $state<Route>('set')
  /** Base45 payload when opened from a QR code. */
  shared = $state<string | null>(null)

  constructor() {
    this.sync()
    window.addEventListener('hashchange', () => this.sync())
  }

  private sync() {
    const frag = readFragment(location.hash)
    if (frag) {
      this.shared = frag
      this.route = 'shared'
      return
    }
    const r = location.hash.replace(/^#\/?/, '').split('/')[0] as Route
    this.route = ROUTES.includes(r) ? r : 'set'
  }

  go(r: Route) {
    if (location.hash !== `#/${r}`) location.hash = `/${r}`
    window.scrollTo({ top: 0 })
  }
}

export const router = new Router()
