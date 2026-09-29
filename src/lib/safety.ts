/**
 * Food-safety constants. Hard-coded on purpose (USDA FSIS guidance) — never taken from
 * generated recipe text.
 */
export const SAFE_TEMPS = {
  poultry: { f: 165, c: 74, label: 'Poultry (incl. ground turkey & chicken)' },
  groundMeat: { f: 160, c: 71, label: 'Ground beef, pork, lamb' },
} as const

/** Default fridge life for cooked proteins, in days. */
export const COOKED_PROTEIN_FRIDGE_DAYS = 4

/** Cooked food should be refrigerated within this many hours. */
export const COOL_WITHIN_HOURS = 2

export const SAFETY_TIPS = [
  `Cook poultry — including ground turkey — to ${SAFE_TEMPS.poultry.f}°F / ${SAFE_TEMPS.poultry.c}°C.`,
  `Cook other ground meats to ${SAFE_TEMPS.groundMeat.f}°F / ${SAFE_TEMPS.groundMeat.c}°C.`,
  `Refrigerate cooked food within ${COOL_WITHIN_HOURS} hours. Spread rice and grains out so they cool fast.`,
  `Cooked proteins keep ${COOKED_PROTEIN_FRIDGE_DAYS - 1}–${COOKED_PROTEIN_FRIDGE_DAYS} days in the fridge. Freeze anything you won't eat by then.`,
  'Reheat leftovers until steaming hot (165°F / 74°C).',
]
