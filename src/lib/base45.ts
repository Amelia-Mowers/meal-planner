/** RFC 9285 Base45. Matches the QR-code alphanumeric character set. */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]))

export function encode(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let x = bytes[i] * 256 + bytes[i + 1]
      const c = x % 45
      x = (x - c) / 45
      const d = x % 45
      const e = (x - d) / 45
      out += ALPHABET[c] + ALPHABET[d] + ALPHABET[e]
    } else {
      const x = bytes[i]
      out += ALPHABET[x % 45] + ALPHABET[Math.floor(x / 45)]
    }
  }
  return out
}

export function decode(s: string): Uint8Array {
  const out: number[] = []
  const val = (ch: string) => {
    const v = LOOKUP.get(ch)
    if (v === undefined) throw new Error(`Invalid base45 character "${ch}"`)
    return v
  }
  for (let i = 0; i < s.length; i += 3) {
    const chunk = s.slice(i, i + 3)
    if (chunk.length === 3) {
      const x = val(chunk[0]) + val(chunk[1]) * 45 + val(chunk[2]) * 2025
      if (x > 0xffff) throw new Error('Invalid base45 triplet')
      out.push(x >> 8, x & 0xff)
    } else if (chunk.length === 2) {
      const x = val(chunk[0]) + val(chunk[1]) * 45
      if (x > 0xff) throw new Error('Invalid base45 pair')
      out.push(x)
    } else throw new Error('Invalid base45 length')
  }
  return new Uint8Array(out)
}
