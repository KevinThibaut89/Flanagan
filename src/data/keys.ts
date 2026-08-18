/** Single source of truth for React Query cache keys. */
export const queryKeys = {
  profile: (userId?: string) => ['profile', userId] as const,
  plan: (userId?: string) => ['plan', userId] as const,

  bottles: (userId?: string) => ['bottles', userId] as const,
  bottle: (id: string) => ['bottle', id] as const,

  ingredients: () => ['ingredients'] as const,
  staples: () => ['ingredients', 'staples'] as const,
  availableIngredientIds: (userId?: string) => ['available-ingredients', userId] as const,

  recipes: (userId?: string) => ['recipes', userId] as const,
  recipe: (id: string) => ['recipe', id] as const,
  makeableRecipeIds: (userId?: string) => ['makeable-recipes', userId] as const,

  productByBarcode: (barcode: string) => ['product', barcode] as const,
};
