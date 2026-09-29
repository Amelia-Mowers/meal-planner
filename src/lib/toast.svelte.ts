export interface Toast {
  id: number
  message: string
  actionLabel?: string
  action?: () => void
}

class Toasts {
  items = $state<Toast[]>([])
  private seq = 0

  show(message: string, opts: { actionLabel?: string; action?: () => void; ms?: number } = {}) {
    const id = ++this.seq
    this.items = [...this.items.slice(-2), { id, message, actionLabel: opts.actionLabel, action: opts.action }]
    setTimeout(() => this.dismiss(id), opts.ms ?? (opts.action ? 6000 : 3000))
  }
  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id)
  }
}

export const toasts = new Toasts()
