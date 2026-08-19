/**
 * Text folding shared by every search box in the app. Kept here rather than
 * next to either caller so the ingredient index and the recipe library compare
 * strings exactly the same way — a query that finds a recipe should find the
 * ingredient it is named after.
 */

/** Lowercase, diacritics stripped, whitespace trimmed — so "Añejo" finds "anejo". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

/** Split a query into the terms that all have to match. */
export function searchTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}
