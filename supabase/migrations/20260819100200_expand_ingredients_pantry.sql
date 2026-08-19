-- The non-alcoholic half of the same expansion. Same rules as
-- 20260819100100_expand_ingredients_drinks.sql: nothing is a staple, no
-- existing row is touched, and only slugs introduced here get parented.
--
-- Each group sits one sort_order above its existing band so the everyday items
-- (lime juice, simple syrup, soda water) stay at the top of the picker and the
-- long tail sorts underneath them.

insert into public.ingredients (slug, name, kind, aliases, is_staple, sort_order) values
  -- ── Juice & purée ────────────────────────────────────────────────────────
  ('yuzu-juice',          'Yuzu juice',           'juice', '{"yuzu"}', false, 201),
  ('calamansi-juice',     'Calamansi juice',      'juice', '{"calamansi"}', false, 201),
  ('blood-orange-juice',  'Blood orange juice',   'juice', '{"blood orange"}', false, 201),
  ('pomegranate-juice',   'Pomegranate juice',    'juice', '{"pomegranate"}', false, 201),
  ('verjus',              'Verjus',               'juice', '{"verjuice"}', false, 201),
  ('watermelon-juice',    'Watermelon juice',     'juice', '{"watermelon"}', false, 201),
  ('carrot-juice',        'Carrot juice',         'juice', '{}', false, 201),
  ('celery-juice',        'Celery juice',         'juice', '{}', false, 201),
  ('clamato',             'Clamato',              'juice', '{"clam juice"}', false, 201),
  ('coconut-water',       'Coconut water',        'juice', '{}', false, 201),
  ('mango-puree',         'Mango purée',          'juice', '{"mango"}', false, 201),
  ('guava-nectar',        'Guava nectar',         'juice', '{"guava"}', false, 201),
  ('apricot-puree',       'Apricot purée',        'juice', '{"apricot"}', false, 201),
  ('peach-puree',         'Peach purée',          'juice', '{"peach"}', false, 201),
  ('strawberry-puree',    'Strawberry purée',     'juice', '{"strawberry"}', false, 201),
  ('raspberry-puree',     'Raspberry purée',      'juice', '{"raspberry"}', false, 201),

  -- ── Syrups & cordials ────────────────────────────────────────────────────
  ('hibiscus-syrup',      'Hibiscus syrup',       'syrup', '{"jamaica syrup"}', false, 211),
  ('coconut-syrup',       'Coconut syrup',        'syrup', '{}', false, 211),
  ('pineapple-syrup',     'Pineapple syrup',      'syrup', '{}', false, 211),
  ('tamarind-syrup',      'Tamarind syrup',       'syrup', '{"tamarind"}', false, 211),
  ('pandan-syrup',        'Pandan syrup',         'syrup', '{}', false, 211),
  ('cane-syrup',          'Cane syrup',           'syrup', '{"sugarcane syrup"}', false, 211),
  ('tonic-syrup',         'Tonic syrup',          'syrup', '{}', false, 211),
  ('chilli-syrup',        'Chilli syrup',         'syrup', '{"chili syrup"}', false, 211),
  ('coffee-syrup',        'Coffee syrup',         'syrup', '{}', false, 211),
  ('mint-syrup',          'Mint syrup',           'syrup', '{}', false, 211),
  ('cardamom-syrup',      'Cardamom syrup',       'syrup', '{}', false, 211),
  ('strawberry-syrup',    'Strawberry syrup',     'syrup', '{}', false, 211),
  ('lime-cordial',        'Lime cordial',         'syrup', '{"roses lime"}', false, 211),
  ('oleo-saccharum',      'Oleo saccharum',       'syrup', '{"oleo"}', false, 211),
  ('saline-solution',     'Saline solution',      'syrup', '{"saline"}', false, 211),

  -- ── Mixers & dairy ───────────────────────────────────────────────────────
  ('grapefruit-soda',     'Grapefruit soda',      'mixer', '{"squirt","ting"}', false, 222),
  ('bitter-lemon',        'Bitter lemon',         'mixer', '{}', false, 222),
  ('root-beer',           'Root beer',            'mixer', '{}', false, 222),
  ('cream-soda',          'Cream soda',           'mixer', '{}', false, 222),
  ('orange-soda',         'Orange soda',          'mixer', '{}', false, 222),
  ('kombucha',            'Kombucha',             'mixer', '{}', false, 222),
  ('iced-tea',            'Iced tea',             'mixer', '{}', false, 222),
  ('matcha',              'Matcha',               'mixer', '{}', false, 222),
  ('coconut-milk',        'Coconut milk',         'mixer', '{}', false, 222),
  ('condensed-milk',      'Condensed milk',       'mixer', '{"sweetened condensed milk"}', false, 222),
  ('oat-milk',            'Oat milk',             'mixer', '{}', false, 222),
  ('almond-milk',         'Almond milk',          'mixer', '{}', false, 222),

  -- ── Herbs ────────────────────────────────────────────────────────────────
  ('sage',                'Sage',                 'garnish', '{}', false, 230),
  ('tarragon',            'Tarragon',             'garnish', '{}', false, 230),
  ('shiso',               'Shiso',                'garnish', '{"perilla"}', false, 230),
  ('lemongrass',          'Lemongrass',           'garnish', '{}', false, 230),
  ('makrut-lime-leaf',    'Makrut lime leaf',     'garnish', '{"kaffir lime leaf"}', false, 230),

  -- ── Citrus garnish ───────────────────────────────────────────────────────
  -- Missing until now, and between them they garnish most of the canon.
  ('orange-peel',         'Orange peel',          'garnish', '{"orange twist","orange zest"}', false, 232),
  ('lemon-peel',          'Lemon peel',           'garnish', '{"lemon twist","lemon zest"}', false, 232),
  ('grapefruit-peel',     'Grapefruit peel',      'garnish', '{"grapefruit twist"}', false, 232),
  ('lime-wedge',          'Lime wedge',           'garnish', '{"lime wheel"}', false, 232),
  ('dehydrated-citrus',   'Dehydrated citrus wheel', 'garnish', '{"dried citrus"}', false, 232),

  -- ── Spice & seasoning ────────────────────────────────────────────────────
  ('star-anise',          'Star anise',           'garnish', '{}', false, 234),
  ('clove',               'Clove',                'garnish', '{"cloves"}', false, 234),
  ('cardamom-pod',        'Cardamom pod',         'garnish', '{"cardamom"}', false, 234),
  ('pink-peppercorn',     'Pink peppercorn',      'garnish', '{}', false, 234),
  ('smoked-paprika',      'Smoked paprika',       'garnish', '{"paprika"}', false, 234),
  ('celery-salt',         'Celery salt',          'garnish', '{}', false, 234),
  ('tajin',               'Tajín',                'garnish', '{}', false, 234),
  ('cocoa-powder',        'Cocoa powder',         'garnish', '{"cacao powder"}', false, 234),
  ('coffee-beans',        'Coffee beans',         'garnish', '{"espresso beans"}', false, 234)
on conflict (slug) do nothing;

-- No parent wiring in this file. None of these rows is a substitute for
-- another: a lime wedge does not stand in for a cocktail cherry, and matcha
-- does not stand in for tea. They are all their own leaf.
