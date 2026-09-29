/**
 * Laptop → phone handoff via URL fragment (never sent to the server).
 * JSON → deflate-raw (CompressionStream) → Base45 → fragment-safe escaping.
 *
 * Base45 includes " " and "%", which aren't safe in URLs, so those two are percent-escaped.
 * "%20" and "%25" are themselves in the QR alphanumeric set, so the payload segment stays
 * in the dense alphanumeric QR mode.
 */
import * as b45 from './base45'

/** [componentSlug, value, unit] */
export type PortionTuple = [string, number, string]

/**
 * A whole plan period, compact. Combo and component IDs drop their "combo/" / "comp/" prefix.
 * The phone rebuilds the prep set, shopping list and prep plan from its own copy of the
 * library; `s` is a precomputed shopping list used only when that isn't possible (older
 * library, private recipes the phone doesn't have).
 */
export interface HandoffPayload {
  /** Library version the sender used. */
  v: string
  /** Period: [id, start, days, mealsPerDay, name?] */
  p: [string, string, number, number, string?]
  /** Menu: [comboId, servings, portion overrides?] */
  m: [string, number, PortionTuple[]?][]
  /** Batch adjustments: [componentSlug, batches] */
  a: [string, number][]
  /** Fallback shopping list: [aisle, [[name, amount], …]][] — only sent for private recipes. */
  s?: [string, [string, string][]][]
  /** When the plan last changed (epoch seconds). */
  u?: number
  /** Checkmarks: [list ("c" cart, "h" have, "d" prep done), id, checked 0|1, changed-at epoch seconds or 0] */
  k?: [string, string, 0 | 1, number][]
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function encodePayload(p: HandoffPayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p))
  const deflated = await pipe(json, new CompressionStream('deflate-raw'))
  return b45.encode(deflated).replace(/%/g, '%25').replace(/ /g, '%20')
}

export async function decodePayload(fragment: string): Promise<HandoffPayload> {
  const raw = decodeURIComponent(fragment)
  const bytes = b45.decode(raw)
  const json = await pipe(bytes, new DecompressionStream('deflate-raw'))
  const p = JSON.parse(new TextDecoder().decode(json)) as HandoffPayload
  if (typeof p !== 'object' || !p || !Array.isArray(p.p) || !Array.isArray(p.m)) throw new Error('Not a meal-plan payload')
  return p
}

export const FRAGMENT_KEY = 'p='

export function readFragment(hash: string): string | null {
  const h = hash.replace(/^#/, '')
  return h.startsWith(FRAGMENT_KEY) ? h.slice(FRAGMENT_KEY.length) : null
}

/** Target ~800 bytes for reliable scanning off a screen. */
export const QR_SOFT_LIMIT = 800
