class UI {
  /** Component or combo ID shown in the detail sheet. */
  detail = $state<string | null>(null)
  qrOpen = $state(false)
}
export const ui = new UI()
