/**
 * End-to-end tests in real Chrome on Android (emulator or USB device), via Playwright + adb.
 *
 *   npm run build && npx vite preview --port 4173 &   # serve the app
 *   npm run test:android                               # needs `adb` on PATH and one device
 *
 * The device's localhost:4173 is forwarded to this machine (adb reverse), so the app runs in
 * a secure context like it does on HTTPS. Set APP_URL to test another URL (e.g. the live site).
 * Desktop checks (sync with a "laptop") use Playwright's Chromium, or CHROME_PATH if set.
 */
import { execFileSync } from 'node:child_process'
import { _android as android, chromium } from 'playwright'

const PORT = 4173
const URL = process.env.APP_URL ?? `http://localhost:${PORT}/`
const results = []
const pageErrors = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const [device] = await android.devices()
if (!device) {
  console.error('No Android device found (adb devices). Start an emulator or plug in a phone.')
  process.exit(1)
}
console.log(`Device: ${device.model()} (${device.serial()})`)
if (!process.env.APP_URL) execFileSync('adb', ['-s', device.serial(), 'reverse', `tcp:${PORT}`, `tcp:${PORT}`])

// Fresh Chrome data so runs are repeatable.
await device.shell('pm clear com.android.chrome')
// Chrome asks for notification permission on first run; that native dialog blocks the page.
await device.shell('pm grant com.android.chrome android.permission.POST_NOTIFICATIONS')

let ctx
async function launch() {
  ctx = await device.launchBrowser({ pkg: 'com.android.chrome' })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.goto(URL)
  await page.waitForSelector('main h1', { timeout: 30000 })
  await wait(800)
  return page
}
const kv = (page) =>
  page.evaluate(
    () =>
      new Promise((r) => {
        const q = indexedDB.open('meal-planner')
        q.onsuccess = () => {
          const t = q.result.transaction('kv').objectStore('kv').getAll()
          t.onsuccess = () => r(Object.fromEntries(t.result.map((x) => [x.key, x.value])))
        }
      }),
  )
async function planWeek(page, starter) {
  await page.getByText('Plan a period').first().click()
  await wait(400)
  await page.getByText('Start planning').click()
  await wait(400)
  await page.getByText(starter).first().click()
  await wait(800)
}

try {
  // 1 ── Plan survives Android killing Chrome
  let page = await launch()
  await planWeek(page, 'Taco week')
  const before = await kv(page)
  check('plan saved to IndexedDB', before.menu?.length === 2, `${before.menu?.length} combos`)
  await ctx.close()
  await device.shell('am force-stop com.android.chrome')
  page = await launch()
  const titles = await page.locator('article h3').allInnerTexts()
  check('plan survives Chrome being killed', titles.includes('Chipotle Chicken Bowl'), titles.join(', '))

  // 2 ── New period archives the old one; it survives a restart and can be restored
  await page.getByText('New period').first().click()
  await wait(400)
  await page.getByText('Start planning').click()
  await wait(400)
  await page.getByText('Greek diner').first().click()
  await wait(800)
  await ctx.close()
  await device.shell('am force-stop com.android.chrome')
  page = await launch()
  await page.getByText(/Past periods/).click()
  await wait(400)
  const past = await page.locator('.list .nm').allInnerTexts()
  check('past period kept after restart', past.length === 1, past.join(', '))
  await page.getByRole('button', { name: 'Restore' }).first().click()
  await wait(600)
  const restored = await page.locator('article h3').allInnerTexts()
  check('restore brings the old plan back', restored.includes('Turkey Taco Wrap'), restored.join(', '))

  // 3 ── A stale second tab doesn't overwrite newer data
  const tab2 = await ctx.newPage()
  tab2.on('pageerror', (e) => pageErrors.push(e.message))
  await tab2.goto(URL)
  await wait(1200)
  await page.bringToFront()
  await page.getByText('New period').first().click()
  await wait(400)
  await page.getByText('Start planning').click()
  await wait(400)
  await page.getByText('Seoul & soba').first().click()
  await wait(800)
  await tab2.bringToFront()
  await tab2.evaluate(() => (location.hash = '/shop'))
  await wait(600)
  await tab2.locator('label.item').first().click()
  await wait(800)
  const after = await kv(tab2)
  const tab2Meals = await tab2.evaluate(() => (location.hash = '/plan')).then(() => wait(500)).then(() => tab2.locator('article h3').allInnerTexts())
  check('second tab picked up the new period', tab2Meals.some((t) => t.startsWith('Gochujang')), tab2Meals.join(', '))
  check('history intact after stale tab edits', (after.history ?? []).length === 2, `${(after.history ?? []).length} past periods`)
  await tab2.close()

  // 4 ── Sync handshake with a "laptop" (desktop Chromium)
  const desktop = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
  const laptopCtx = await desktop.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const laptop = await laptopCtx.newPage()
  laptop.on('pageerror', (e) => pageErrors.push(e.message))
  await laptop.goto(`http://localhost:${PORT}/`)
  await wait(800)
  await planWeek(laptop, 'World tour')
  await laptop.getByText('Sync devices').first().click()
  await wait(1200)
  await laptop.getByText('Copy link').click()
  await wait(300)
  const link = (await laptop.evaluate(() => navigator.clipboard.readText())).replace(/^https?:\/\/[^/]+\//, URL)
  await laptop.keyboard.press('Escape')

  await page.bringToFront()
  await page.getByRole('button', { name: /Scan/ }).first().click()
  await wait(800)
  await page.locator('#paste-link').fill(link)
  await page.getByRole('button', { name: 'Open' }).click()
  await wait(1000)
  await page.getByRole('button', { name: /Sync to this device/ }).click()
  await wait(600)
  await page.getByText('Done').click()
  await wait(600)
  const synced = await page.locator('article h3').allInnerTexts()
  check('phone received the laptop plan', synced.includes('Ginger-Scallion Chicken Rice'), synced.join(', '))

  await page.evaluate(() => (location.hash = '/shop'))
  await wait(600)
  await page.locator('label.item').nth(0).click()
  await page.locator('label.item').nth(1).click()
  await wait(400)
  const phoneCart = await page.locator('li.checked .nm').allInnerTexts()
  await page.evaluate(() => (location.hash = '/plan'))
  await wait(500)
  await page.getByRole('button', { name: /Sync devices/ }).first().click()
  await wait(1500)
  // Read the phone's link straight from the QR sheet's state (clipboard isn't scriptable on Android).
  const phoneLink = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Copy link'))
    let captured = ''
    const orig = navigator.clipboard?.writeText?.bind(navigator.clipboard)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => (captured = t) }, configurable: true })
    btn?.click()
    await new Promise((r) => setTimeout(r, 200))
    if (orig) Object.defineProperty(navigator, 'clipboard', { value: { writeText: orig }, configurable: true })
    return captured
  })
  await laptop.getByRole('button', { name: /Scan/ }).first().click()
  await wait(500)
  await laptop.locator('#paste-link').fill(phoneLink.replace(/^https?:\/\/[^/]+\//, `http://localhost:${PORT}/`))
  await laptop.getByRole('button', { name: 'Open' }).click()
  await wait(800)
  await laptop.getByRole('button', { name: 'Merge' }).click()
  await wait(500)
  await laptop.getByText('Done').click()
  await laptop.evaluate(() => (location.hash = '/shop'))
  await wait(600)
  const laptopCart = await laptop.locator('li.checked .nm').allInnerTexts()
  check(
    'laptop merged the phone’s checkmarks',
    phoneCart.length === 2 && phoneCart.every((x) => laptopCart.includes(x)),
    `phone [${phoneCart.join(', ')}] → laptop [${laptopCart.join(', ')}]`,
  )
  await desktop.close()

  // 5 ── Offline: service worker serves the app with no network
  await ctx.close()
  await device.shell('svc wifi disable; svc data disable')
  if (!process.env.APP_URL) execFileSync('adb', ['-s', device.serial(), 'reverse', '--remove-all'])
  try {
    page = await launch()
    const offlineTitles = await page.locator('article h3').allInnerTexts()
    check('app opens offline with the plan', offlineTitles.length > 0, offlineTitles.join(', '))
  } catch (e) {
    check('app opens offline with the plan', false, e.message.split('\n')[0])
  } finally {
    await device.shell('svc wifi enable; svc data enable')
  }
} catch (e) {
  check('test run completed', false, e.message.split('\n')[0])
} finally {
  await ctx?.close().catch(() => {})
  await device.close()
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
