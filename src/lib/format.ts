import type { Role } from './types'

export const ROLE_LABEL: Record<Role, string> = {
  protein: 'Protein',
  base: 'Base',
  veg: 'Veg',
  sauce: 'Sauce',
  topper: 'Topper',
  dish: 'Dish',
  fruit: 'Fruit',
}
export const ROLE_PLURAL: Record<Role, string> = {
  protein: 'Proteins',
  base: 'Bases',
  veg: 'Veg',
  sauce: 'Sauces',
  topper: 'Toppers',
  dish: 'Dishes',
  fruit: 'Fruit',
}
export const CUISINE_LABEL: Record<string, string> = {
  mexican: 'Mexican',
  mediterranean: 'Mediterranean',
  'east-asian': 'East Asian',
  italian: 'Italian',
  neutral: 'Goes with anything',
}
export const cuisineShort = (c: string) => (c === 'neutral' ? 'Neutral' : (CUISINE_LABEL[c] ?? c))

export const kcal = (n: number) => `${Math.round(n)}`
export const grams = (n: number) => `${Math.round(n)} g`

export function minutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`
}

export const FORMAT_LABEL: Record<string, string> = { bowl: 'Bowl', wrap: 'Wrap', plate: 'Plate' }
