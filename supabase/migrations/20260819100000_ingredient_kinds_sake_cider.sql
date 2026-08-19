-- Rice wine and cider are their own families, not sub-cases of wine and beer:
-- a recipe calling for sake is not satisfied by a bottle of Sancerre, and the
-- picker should say "Sake", not "Wine".
--
-- These land in a migration of their own because a new enum label cannot be
-- *used* by the transaction that adds it. The rows that use them are in
-- 20260819100100_expand_ingredients_drinks.sql.

alter type public.ingredient_kind add value if not exists 'sake' after 'beer';
alter type public.ingredient_kind add value if not exists 'cider' after 'sake';
