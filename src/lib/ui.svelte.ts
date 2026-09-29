class UI {
  /** Component or combo ID shown in the detail sheet. */
  detail = $state<string | null>(null)
  /** Show-my-code QR sheet. */
  syncOpen = $state(false)
  /** Camera scanner sheet. */
  scanOpen = $state(false)
  /** Period settings / new period sheet. */
  periodSheet = $state<null | 'edit' | 'new'>(null)
  /** Build-your-own combo sheet. */
  builderOpen = $state(false)
  /** Add-extra-component picker. */
  extraOpen = $state(false)
}
export const ui = new UI()
