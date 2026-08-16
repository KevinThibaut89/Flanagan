-- Shared vocabulary for the whole schema. Enums rather than check constraints so
-- the generated TypeScript types carry the allowed values.

create type public.ingredient_kind as enum (
  'spirit',
  'liqueur',
  'vermouth',
  'amaro',
  'bitters',
  'fortified',
  'wine',
  'beer',
  'juice',
  'syrup',
  'mixer',
  'garnish',
  'other'
);

create type public.product_source as enum ('off', 'user');

-- 'staple' covers the non-bottle things a bar still needs: citrus, syrup, soda,
-- egg. They live in the same table because "can I make this?" has to consider
-- them exactly like a bottle of gin.
create type public.bottle_kind as enum ('bottle', 'staple');

create type public.bottle_status as enum ('in_stock', 'finished', 'wishlist');

create type public.recipe_source as enum ('ai', 'user', 'classic');

create type public.recipe_method as enum (
  'shake',
  'stir',
  'build',
  'blend',
  'throw',
  'swizzle',
  'muddle'
);

create type public.recipe_ice as enum ('none', 'cubed', 'crushed', 'large_cube', 'block');

create type public.measure_unit as enum (
  'ml',
  'cl',
  'oz',
  'dash',
  'barspoon',
  'tsp',
  'tbsp',
  'drop',
  'piece',
  'pinch',
  'splash',
  'top'
);

create type public.unit_preference as enum ('metric', 'imperial');

-- Keeps updated_at honest without every caller remembering to set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
