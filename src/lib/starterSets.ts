/** Themed bundles of combos. Servings are spread over the period's meal count by weight. */
export interface StarterPlan {
  id: string
  name: string
  blurb: string
  emoji: string
  combos: [comboId: string, weight: number][]
}

export const STARTER_PLANS: StarterPlan[] = [
  {
    id: 'taco',
    name: 'Taco week',
    blurb: 'Chipotle chicken bowls & turkey taco wraps',
    emoji: '🌮',
    combos: [
      ['combo/chipotle-chicken-bowl', 1],
      ['combo/turkey-taco-wrap', 1],
    ],
  },
  {
    id: 'greek',
    name: 'Greek diner',
    blurb: 'Chicken pitas & kofta couscous bowls',
    emoji: '🥙',
    combos: [
      ['combo/chicken-pita-tzatziki', 1],
      ['combo/kofta-couscous-bowl', 1],
    ],
  },
  {
    id: 'seoul',
    name: 'Seoul & soba',
    blurb: 'Gochujang turkey bowls & peanut soba',
    emoji: '🥢',
    combos: [
      ['combo/gochujang-turkey-bowl', 1],
      ['combo/peanut-soba-tofu', 1],
    ],
  },
  {
    id: 'pasta',
    name: 'Pasta night',
    blurb: 'Turkey marinara, cheeseburger mac & chicken Alfredo',
    emoji: '🍝',
    combos: [
      ['combo/turkey-marinara-bowl', 1],
      ['combo/cheeseburger-mac', 1],
      ['combo/chicken-alfredo', 1],
    ],
  },
  {
    id: 'tour',
    name: 'World tour',
    blurb: 'One Mexican, one Greek, one Asian',
    emoji: '🌍',
    combos: [
      ['combo/chipotle-chicken-bowl', 1],
      ['combo/kofta-couscous-bowl', 1],
      ['combo/ginger-scallion-chicken-bowl', 1],
    ],
  },
]

/** Split `meals` across weighted combos (largest-remainder), at least 1 each. */
export function distribute(combos: [string, number][], meals: number): [string, number][] {
  const total = combos.reduce((s, [, w]) => s + w, 0)
  const n = Math.max(meals, combos.length)
  const raw = combos.map(([id, w]) => [id, (w / total) * n] as [string, number])
  const out = raw.map(([id, v]) => [id, Math.max(1, Math.floor(v))] as [string, number])
  let left = n - out.reduce((s, [, v]) => s + v, 0)
  const order = raw.map(([, v], i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]][1]++
  return out
}
