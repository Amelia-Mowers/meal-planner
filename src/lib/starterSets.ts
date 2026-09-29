export interface StarterSet {
  id: string
  name: string
  blurb: string
  emoji: string
  components: string[]
}

const c = (...slugs: string[]) => slugs.map((s) => `comp/${s}`)

export const STARTER_SETS: StarterSet[] = [
  {
    id: 'taco-week',
    name: 'Taco week',
    blurb: 'Chipotle chicken bowls & turkey taco wraps',
    emoji: '🌮',
    components: c(
      'chicken-sheetpan', 'turkey-taco', 'black-beans',
      'rice-white', 'tortilla-high-protein',
      'broccoli-slaw', 'romaine', 'cabbage-slaw', 'pickled-red-onion', 'pickled-jalapenos',
      'yogurt-chipotle-crema', 'yogurt-lime-crema',
      'cotija',
    ),
  },
  {
    id: 'greek-diner',
    name: 'Greek diner',
    blurb: 'Chicken pitas & kofta couscous bowls',
    emoji: '🥙',
    components: c(
      'chicken-rotisserie', 'turkey-kofta',
      'couscous', 'pita',
      'cucumber', 'cherry-tomatoes', 'pickled-red-onion',
      'tzatziki', 'lemon-tahini',
      'feta',
    ),
  },
  {
    id: 'seoul-soba',
    name: 'Seoul & soba',
    blurb: 'Gochujang turkey bowls & peanut soba',
    emoji: '🥢',
    components: c(
      'turkey-gochujang', 'tofu-baked', 'eggs-jammy',
      'rice-white', 'soba',
      'kimchi', 'pickled-cucumber', 'broccoli-slaw', 'edamame', 'spinach-frozen', 'carrot-shredded',
      'gochujang-honey', 'peanut-lime',
      'sesame-seeds', 'cilantro',
    ),
  },
  {
    id: 'lazy-mix',
    name: 'Zero-cook mix',
    blurb: 'Rotisserie chicken, bagged veg, three sauces',
    emoji: '🛒',
    components: c(
      'chicken-rotisserie', 'chickpeas-lemon',
      'tortilla-high-protein', 'couscous',
      'broccoli-slaw', 'cucumber', 'carrot-shredded', 'pickled-red-onion',
      'tzatziki', 'sesame-soy', 'honey-mustard',
    ),
  },
]

/** Suggested counts per role for a weekly prep set. */
export const ROLE_TARGETS = {
  protein: { min: 2, max: 3, label: 'Proteins', hint: '2 proteins' },
  base: { min: 1, max: 2, label: 'Bases', hint: '1–2 bases' },
  veg: { min: 3, max: 5, label: 'Veg', hint: '3 or more veg' },
  sauce: { min: 2, max: 3, label: 'Sauces', hint: '2–3 sauces' },
  topper: { min: 0, max: 2, label: 'Toppers', hint: 'optional' },
} as const
