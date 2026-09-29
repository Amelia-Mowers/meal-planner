import type { QuantitativeValue, Qty } from './units'

export type Role = 'protein' | 'base' | 'veg' | 'sauce' | 'topper'
export type Format = 'bowl' | 'wrap'
export type Serve = 'hot' | 'cold' | 'either'
export type Source = 'bundled' | 'private'

export const ROLES: Role[] = ['protein', 'base', 'veg', 'sauce', 'topper']
export const CUISINES = ['mexican', 'mediterranean', 'east-asian', 'neutral'] as const

export interface Nutrients {
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
}

export interface Food {
  id: string
  name: string
  aliases: string[]
  fdcId: number | null
  fdcDescription?: string
  nutritionSource: 'usda-sr-legacy' | 'label' | string
  per100g: Nutrients
  gramsPerUnit?: Record<string, number>
  densityGPerMl?: number | null
  aisle: string
  buyUnit: QuantitativeValue
  pantry?: boolean
  needsReview?: boolean
  note?: string
}

export interface HowToSupply {
  '@type': 'HowToSupply'
  name?: string
  description?: string
  identifier: string
  requiredQuantity?: QuantitativeValue
}

/** schema.org Recipe JSON-LD as stored. Extension fields use the `mp:` prefix. */
export interface RecipeDoc {
  '@type': 'Recipe'
  '@id': string
  name: string
  alternateName?: string
  description?: string
  recipeCategory: Role | 'combo'
  recipeCuisine?: string | string[]
  recipeIngredient?: string[]
  recipeYield?: QuantitativeValue
  supply?: HowToSupply[]
  tool?: { '@type': 'HowToTool'; name: string }[]
  recipeInstructions?: { '@type': 'HowToStep'; text: string }[]
  prepTime?: string
  cookTime?: string
  totalTime?: string
  keywords?: string | string[]
  author?: { '@type': string; name: string }
  license?: string
  isBasedOn?: string | { '@type'?: string; name?: string; url?: string }
  'mp:formats'?: Format[]
  'mp:format'?: Format
  'mp:portion'?: QuantitativeValue
  'mp:portionRange'?: { minValue: number; maxValue: number }
  'mp:tested'?: boolean
  'mp:needsReview'?: boolean
  'mp:fridgeDays'?: number | null
  'mp:freezable'?: boolean
  'mp:serve'?: Serve
  'mp:secondary'?: boolean
  'mp:batchGroup'?: string
  [k: string]: unknown
}

export interface LibraryFile {
  '@context': unknown
  'mp:version'?: string
  '@graph': RecipeDoc[]
  foods?: Food[]
}

export interface Supply {
  foodId: string
  qty: Qty
  description?: string
}

export interface Component {
  id: string
  name: string
  shortName: string
  description: string
  role: Role
  cuisines: string[]
  formats: Format[]
  portion: Qty
  portionRange?: [number, number]
  yield: Qty
  supplies: Supply[]
  steps: string[]
  tools: string[]
  prepMin: number
  cookMin: number
  fridgeDays: number | null
  freezable: boolean
  serve: Serve
  keywords: string[]
  secondary: boolean
  batchGroup?: string
  tested: boolean
  needsReview: boolean
  license?: string
  author?: string
  isBasedOn?: string
  source: Source
  doc: RecipeDoc
}

export interface ComboPart {
  componentId: string
  qty?: Qty
}

export interface Combo {
  id: string
  name: string
  description: string
  format: Format
  cuisine: string
  parts: ComboPart[]
  curated: boolean
  tested: boolean
  source: Source
  doc?: RecipeDoc
}

export interface Library {
  version: string
  foods: Map<string, Food>
  components: Map<string, Component>
  combos: Map<string, Combo>
}

export interface Targets {
  kcal: number
  protein: number
  /** Fractional tolerance on kcal, e.g. 0.1 = ±10%. */
  tolerance: number
}

export interface MenuItem {
  comboId: string
  servings: number
  /** Per-component portion overrides (from the portion slider). */
  portions?: Record<string, Qty>
}
