-- The starting vocabulary: roughly the contents of a well-equipped home bar.
--
-- Rows are inserted flat, then the parent chain is wired up by slug at the
-- bottom. `sort_order` groups things sensibly in pickers; `is_staple` marks the
-- items offered on the one-tap Staples screen.
--
-- Parenting rule: a child must be a *valid substitute* for its parent. Old Tom
-- gin is a gin, so `gin` → `old-tom-gin`. Sloe gin is not, so it stands alone.

insert into public.ingredients (slug, name, kind, aliases, is_staple, sort_order) values
  -- ── Gin ──────────────────────────────────────────────────────────────────
  ('gin',                 'Gin',                  'spirit', '{}', false, 10),
  ('london-dry-gin',      'London dry gin',       'spirit', '{"london dry"}', false, 11),
  ('plymouth-gin',        'Plymouth gin',         'spirit', '{}', false, 11),
  ('old-tom-gin',         'Old Tom gin',          'spirit', '{}', false, 11),
  ('navy-strength-gin',   'Navy strength gin',    'spirit', '{"overproof gin"}', false, 11),
  ('genever',             'Genever',              'spirit', '{"jenever","dutch gin"}', false, 11),

  -- ── Vodka ────────────────────────────────────────────────────────────────
  ('vodka',               'Vodka',                'spirit', '{}', false, 20),

  -- ── Whisky ───────────────────────────────────────────────────────────────
  ('whisky',              'Whisky',               'spirit', '{"whiskey"}', false, 30),
  ('scotch',              'Scotch',               'spirit', '{"scotch whisky"}', false, 31),
  ('blended-scotch',      'Blended Scotch',       'spirit', '{}', false, 32),
  ('single-malt-scotch',  'Single malt Scotch',   'spirit', '{"single malt"}', false, 32),
  ('islay-scotch',        'Islay Scotch',         'spirit', '{"peated scotch","smoky scotch"}', false, 32),
  ('irish-whiskey',       'Irish whiskey',        'spirit', '{}', false, 31),
  ('bourbon',             'Bourbon',              'spirit', '{"bourbon whiskey"}', false, 31),
  ('rye-whiskey',         'Rye whiskey',          'spirit', '{"rye"}', false, 31),
  ('tennessee-whiskey',   'Tennessee whiskey',    'spirit', '{}', false, 31),
  ('japanese-whisky',     'Japanese whisky',      'spirit', '{}', false, 31),
  ('canadian-whisky',     'Canadian whisky',      'spirit', '{}', false, 31),

  -- ── Rum ──────────────────────────────────────────────────────────────────
  ('rum',                 'Rum',                  'spirit', '{}', false, 40),
  ('white-rum',           'White rum',            'spirit', '{"light rum","silver rum"}', false, 41),
  ('gold-rum',            'Gold rum',             'spirit', '{"amber rum"}', false, 41),
  ('dark-rum',            'Dark rum',             'spirit', '{"black rum"}', false, 41),
  ('aged-rum',            'Aged rum',             'spirit', '{"rhum vieux"}', false, 41),
  ('jamaican-rum',        'Jamaican rum',         'spirit', '{"funky rum"}', false, 41),
  ('agricole-rhum',       'Rhum agricole',        'spirit', '{"agricole"}', false, 41),
  ('overproof-rum',       'Overproof rum',        'spirit', '{"151 rum"}', false, 41),
  ('spiced-rum',          'Spiced rum',           'spirit', '{}', false, 41),
  ('cachaca',             'Cachaça',              'spirit', '{"cachaca"}', false, 42),

  -- ── Agave ────────────────────────────────────────────────────────────────
  ('tequila',             'Tequila',              'spirit', '{}', false, 50),
  ('blanco-tequila',      'Blanco tequila',       'spirit', '{"silver tequila","plata"}', false, 51),
  ('reposado-tequila',    'Reposado tequila',     'spirit', '{}', false, 51),
  ('anejo-tequila',       'Añejo tequila',        'spirit', '{"anejo tequila"}', false, 51),
  ('mezcal',              'Mezcal',               'spirit', '{}', false, 52),

  -- ── Brandy ───────────────────────────────────────────────────────────────
  ('brandy',              'Brandy',               'spirit', '{}', false, 60),
  ('cognac',              'Cognac',               'spirit', '{}', false, 61),
  ('armagnac',            'Armagnac',             'spirit', '{}', false, 61),
  ('calvados',            'Calvados',             'spirit', '{"apple brandy"}', false, 61),
  ('pisco',               'Pisco',                'spirit', '{}', false, 61),
  ('grappa',              'Grappa',               'spirit', '{}', false, 61),

  -- ── Other spirits ────────────────────────────────────────────────────────
  ('absinthe',            'Absinthe',             'spirit', '{}', false, 70),
  ('pastis',              'Pastis',               'spirit', '{"ricard","pernod"}', false, 70),
  ('aquavit',             'Aquavit',              'spirit', '{"akvavit"}', false, 70),

  -- ── Orange liqueurs ──────────────────────────────────────────────────────
  ('orange-liqueur',      'Orange liqueur',       'liqueur', '{}', false, 100),
  ('triple-sec',          'Triple sec',           'liqueur', '{}', false, 101),
  ('cointreau',           'Cointreau',            'liqueur', '{}', false, 101),
  ('dry-curacao',         'Dry curaçao',          'liqueur', '{"orange curacao","dry curacao"}', false, 101),
  ('grand-marnier',       'Grand Marnier',        'liqueur', '{}', false, 101),
  ('blue-curacao',        'Blue curaçao',         'liqueur', '{"blue curacao"}', false, 101),

  -- ── Floral & fruit liqueurs ──────────────────────────────────────────────
  ('elderflower-liqueur', 'Elderflower liqueur',  'liqueur', '{"st germain","st-germain"}', false, 110),
  ('violet-liqueur',      'Crème de violette',    'liqueur', '{"creme de violette","violet liqueur"}', false, 110),
  ('rose-liqueur',        'Rose liqueur',         'liqueur', '{"creme de rose"}', false, 110),
  ('maraschino',          'Maraschino liqueur',   'liqueur', '{"luxardo"}', false, 111),
  ('cherry-liqueur',      'Cherry liqueur',       'liqueur', '{"cherry heering"}', false, 111),
  ('creme-de-cassis',     'Crème de cassis',      'liqueur', '{"creme de cassis"}', false, 111),
  ('creme-de-mure',       'Crème de mûre',        'liqueur', '{"creme de mure","blackberry liqueur"}', false, 111),
  ('apricot-liqueur',     'Apricot liqueur',      'liqueur', '{"apricot brandy"}', false, 111),
  ('peach-liqueur',       'Peach liqueur',        'liqueur', '{"creme de peche","peach schnapps"}', false, 111),
  ('banana-liqueur',      'Banana liqueur',       'liqueur', '{"creme de banane"}', false, 111),
  ('melon-liqueur',       'Melon liqueur',        'liqueur', '{"midori"}', false, 111),
  ('limoncello',          'Limoncello',           'liqueur', '{}', false, 111),
  ('sloe-gin',            'Sloe gin',             'liqueur', '{}', false, 111),

  -- ── Herbal, nutty & other liqueurs ───────────────────────────────────────
  ('green-chartreuse',    'Green Chartreuse',     'liqueur', '{"chartreuse"}', false, 120),
  ('yellow-chartreuse',   'Yellow Chartreuse',    'liqueur', '{}', false, 120),
  ('benedictine',         'Bénédictine',          'liqueur', '{"benedictine","dom"}', false, 120),
  ('drambuie',            'Drambuie',             'liqueur', '{}', false, 120),
  ('galliano',            'Galliano',             'liqueur', '{}', false, 120),
  ('sambuca',             'Sambuca',              'liqueur', '{}', false, 120),
  ('creme-de-menthe',     'Crème de menthe',      'liqueur', '{"creme de menthe"}', false, 120),
  ('creme-de-cacao',      'Crème de cacao',       'liqueur', '{"creme de cacao"}', false, 121),
  ('amaretto',            'Amaretto',             'liqueur', '{}', false, 121),
  ('coffee-liqueur',      'Coffee liqueur',       'liqueur', '{"kahlua","tia maria"}', false, 121),
  ('irish-cream',         'Irish cream',          'liqueur', '{"baileys"}', false, 121),
  ('falernum',            'Falernum',             'liqueur', '{"velvet falernum"}', false, 121),
  ('allspice-dram',       'Allspice dram',        'liqueur', '{"pimento dram"}', false, 121),

  -- ── Amari & bitter apéritifs ─────────────────────────────────────────────
  ('amaro',               'Amaro',                'amaro', '{}', false, 130),
  ('campari',             'Campari',              'amaro', '{}', false, 131),
  ('aperol',              'Aperol',               'amaro', '{}', false, 131),
  ('fernet-branca',       'Fernet-Branca',        'amaro', '{"fernet"}', false, 131),
  ('averna',              'Averna',               'amaro', '{}', false, 131),
  ('montenegro',          'Amaro Montenegro',     'amaro', '{}', false, 131),
  ('cynar',               'Cynar',                'amaro', '{}', false, 131),
  ('nonino',              'Amaro Nonino',         'amaro', '{}', false, 131),
  ('suze',                'Suze',                 'amaro', '{"gentian liqueur"}', false, 131),
  ('pimms',               'Pimm''s No. 1',        'amaro', '{"pimms"}', false, 131),

  -- ── Vermouth & aromatised wine ───────────────────────────────────────────
  ('vermouth',            'Vermouth',             'vermouth', '{}', false, 140),
  ('dry-vermouth',        'Dry vermouth',         'vermouth', '{"french vermouth"}', false, 141),
  ('sweet-vermouth',      'Sweet vermouth',       'vermouth', '{"red vermouth","italian vermouth","rosso"}', false, 141),
  ('blanc-vermouth',      'Blanc vermouth',       'vermouth', '{"bianco vermouth"}', false, 141),
  ('lillet-blanc',        'Lillet Blanc',         'vermouth', '{"lillet"}', false, 142),
  ('cocchi-americano',    'Cocchi Americano',     'vermouth', '{}', false, 142),
  ('dubonnet',            'Dubonnet',             'vermouth', '{}', false, 142),

  -- ── Fortified wine ───────────────────────────────────────────────────────
  ('sherry',              'Sherry',               'fortified', '{}', false, 150),
  ('fino-sherry',         'Fino sherry',          'fortified', '{"manzanilla"}', false, 151),
  ('amontillado-sherry',  'Amontillado sherry',   'fortified', '{"amontillado"}', false, 151),
  ('oloroso-sherry',      'Oloroso sherry',       'fortified', '{"oloroso"}', false, 151),
  ('pedro-ximenez',       'Pedro Ximénez',        'fortified', '{"pedro ximenez","px sherry"}', false, 151),
  ('port',                'Port',                 'fortified', '{}', false, 152),
  ('tawny-port',          'Tawny port',           'fortified', '{}', false, 153),
  ('ruby-port',           'Ruby port',            'fortified', '{}', false, 153),
  ('madeira',             'Madeira',              'fortified', '{}', false, 152),
  ('marsala',             'Marsala',              'fortified', '{}', false, 152),

  -- ── Wine & beer ──────────────────────────────────────────────────────────
  ('sparkling-wine',      'Sparkling wine',       'wine', '{}', false, 160),
  ('champagne',           'Champagne',            'wine', '{}', false, 161),
  ('prosecco',            'Prosecco',             'wine', '{}', false, 161),
  ('cremant',             'Crémant',              'wine', '{"cremant"}', false, 161),
  ('white-wine',          'White wine',           'wine', '{}', false, 162),
  ('red-wine',            'Red wine',             'wine', '{}', false, 162),
  ('rose-wine',           'Rosé wine',            'wine', '{"rose wine"}', false, 162),
  ('lager',               'Lager',                'beer', '{}', false, 170),
  ('stout',               'Stout',                'beer', '{}', false, 170),
  ('ipa',                 'IPA',                  'beer', '{}', false, 170),

  -- ── Bitters ──────────────────────────────────────────────────────────────
  ('bitters',             'Bitters',              'bitters', '{}', false, 180),
  ('angostura-bitters',   'Angostura bitters',    'bitters', '{"angostura","aromatic bitters"}', true, 181),
  ('orange-bitters',      'Orange bitters',       'bitters', '{}', true, 181),
  ('peychauds-bitters',   'Peychaud''s bitters',  'bitters', '{"peychauds"}', false, 181),
  ('chocolate-bitters',   'Chocolate bitters',    'bitters', '{"mole bitters"}', false, 181),
  ('grapefruit-bitters',  'Grapefruit bitters',   'bitters', '{}', false, 181),
  ('celery-bitters',      'Celery bitters',       'bitters', '{}', false, 181),
  ('lavender-bitters',    'Lavender bitters',     'bitters', '{}', false, 181),
  ('cardamom-bitters',    'Cardamom bitters',     'bitters', '{}', false, 181),

  -- ── Juice ────────────────────────────────────────────────────────────────
  ('lime-juice',          'Lime juice',           'juice', '{"lime","limes","fresh lime juice"}', true, 200),
  ('lemon-juice',         'Lemon juice',          'juice', '{"lemon","lemons","fresh lemon juice"}', true, 200),
  ('orange-juice',        'Orange juice',         'juice', '{"orange","oranges"}', true, 200),
  ('grapefruit-juice',    'Grapefruit juice',     'juice', '{"grapefruit"}', false, 200),
  ('pineapple-juice',     'Pineapple juice',      'juice', '{"pineapple"}', false, 200),
  ('cranberry-juice',     'Cranberry juice',      'juice', '{}', false, 200),
  ('apple-juice',         'Apple juice',          'juice', '{}', false, 200),
  ('tomato-juice',        'Tomato juice',         'juice', '{}', false, 200),
  ('passion-fruit-puree', 'Passion fruit purée',  'juice', '{"passion fruit puree","passionfruit"}', false, 200),

  -- ── Syrups ───────────────────────────────────────────────────────────────
  ('simple-syrup',        'Simple syrup',         'syrup', '{"sugar syrup","gomme","gomme syrup"}', true, 210),
  ('demerara-syrup',      'Demerara syrup',       'syrup', '{"rich syrup"}', false, 210),
  ('honey-syrup',         'Honey syrup',          'syrup', '{"honey"}', true, 210),
  ('agave-syrup',         'Agave syrup',          'syrup', '{"agave nectar","agave"}', true, 210),
  ('grenadine',           'Grenadine',            'syrup', '{"pomegranate syrup"}', true, 210),
  ('orgeat',              'Orgeat',               'syrup', '{"almond syrup"}', false, 210),
  ('raspberry-syrup',     'Raspberry syrup',      'syrup', '{}', false, 210),
  ('vanilla-syrup',       'Vanilla syrup',        'syrup', '{}', false, 210),
  ('cinnamon-syrup',      'Cinnamon syrup',       'syrup', '{}', false, 210),
  ('ginger-syrup',        'Ginger syrup',         'syrup', '{}', false, 210),
  ('elderflower-cordial', 'Elderflower cordial',  'syrup', '{}', false, 210),
  ('rose-syrup',          'Rose syrup',           'syrup', '{"rose water"}', false, 210),
  ('lavender-syrup',      'Lavender syrup',       'syrup', '{}', false, 210),
  ('passion-fruit-syrup', 'Passion fruit syrup',  'syrup', '{}', false, 210),
  ('maple-syrup',         'Maple syrup',          'syrup', '{}', false, 210),

  -- ── Mixers & dairy ───────────────────────────────────────────────────────
  ('soda-water',          'Soda water',           'mixer', '{"club soda","sparkling water","seltzer"}', true, 220),
  ('tonic-water',         'Tonic water',          'mixer', '{"tonic"}', true, 220),
  ('ginger-beer',         'Ginger beer',          'mixer', '{}', true, 220),
  ('ginger-ale',          'Ginger ale',           'mixer', '{}', false, 220),
  ('cola',                'Cola',                 'mixer', '{"coke"}', true, 220),
  ('lemonade',            'Lemonade',             'mixer', '{}', false, 220),
  ('coconut-cream',       'Coconut cream',        'mixer', '{"cream of coconut"}', false, 221),
  ('cream',               'Cream',                'mixer', '{"heavy cream","double cream"}', true, 221),
  ('milk',                'Milk',                 'mixer', '{}', false, 221),
  ('egg-white',           'Egg white',            'mixer', '{"egg","eggs"}', true, 221),
  ('coffee',              'Coffee',               'mixer', '{"espresso"}', true, 221),
  ('tea',                 'Tea',                  'mixer', '{}', false, 221),
  ('water',               'Water',                'mixer', '{}', true, 221),

  -- ── Garnishes & seasoning ────────────────────────────────────────────────
  ('mint',                'Mint',                 'garnish', '{"fresh mint","mint sprig"}', true, 230),
  ('basil',               'Basil',                'garnish', '{}', false, 230),
  ('rosemary',            'Rosemary',             'garnish', '{}', false, 230),
  ('thyme',               'Thyme',                'garnish', '{}', false, 230),
  ('lavender-sprig',      'Lavender',             'garnish', '{"lavender sprig"}', false, 230),
  ('edible-flower',       'Edible flower',        'garnish', '{"flower"}', false, 230),
  ('cucumber',            'Cucumber',             'garnish', '{}', false, 231),
  ('ginger-root',         'Fresh ginger',         'garnish', '{"ginger"}', false, 231),
  ('chili',               'Chilli',               'garnish', '{"chili","chile"}', false, 231),
  ('celery',              'Celery',               'garnish', '{}', false, 231),
  ('cocktail-cherry',     'Cocktail cherry',      'garnish', '{"maraschino cherry","cherry"}', true, 232),
  ('olive',               'Olive',                'garnish', '{"olives"}', true, 232),
  ('cocktail-onion',      'Cocktail onion',       'garnish', '{}', false, 232),
  ('nutmeg',              'Nutmeg',               'garnish', '{}', false, 233),
  ('cinnamon-stick',      'Cinnamon stick',       'garnish', '{"cinnamon"}', false, 233),
  ('salt',                'Salt',                 'garnish', '{"sea salt"}', true, 233),
  ('pepper',              'Pepper',               'garnish', '{"black pepper"}', false, 233),
  ('sugar',               'Sugar',                'garnish', '{"caster sugar","sugar cube"}', true, 233),

  -- ── Everything else ──────────────────────────────────────────────────────
  ('ice',                 'Ice',                  'other', '{}', true, 240),
  ('absinthe-rinse',      'Absinthe rinse',       'other', '{}', false, 240);

-- Parent wiring. A child must be an acceptable stand-in for its parent, so that
-- owning the child satisfies a recipe asking for the parent.
with rel(child_slug, parent_slug) as (
  values
    ('london-dry-gin', 'gin'),
    ('plymouth-gin', 'gin'),
    ('old-tom-gin', 'gin'),
    ('navy-strength-gin', 'gin'),
    ('genever', 'gin'),

    ('scotch', 'whisky'),
    ('blended-scotch', 'scotch'),
    ('single-malt-scotch', 'scotch'),
    ('islay-scotch', 'scotch'),
    ('irish-whiskey', 'whisky'),
    ('bourbon', 'whisky'),
    ('rye-whiskey', 'whisky'),
    ('tennessee-whiskey', 'whisky'),
    ('japanese-whisky', 'whisky'),
    ('canadian-whisky', 'whisky'),

    ('white-rum', 'rum'),
    ('gold-rum', 'rum'),
    ('dark-rum', 'rum'),
    ('aged-rum', 'rum'),
    ('jamaican-rum', 'rum'),
    ('agricole-rhum', 'rum'),
    ('overproof-rum', 'rum'),
    ('spiced-rum', 'rum'),

    ('blanco-tequila', 'tequila'),
    ('reposado-tequila', 'tequila'),
    ('anejo-tequila', 'tequila'),

    ('cognac', 'brandy'),
    ('armagnac', 'brandy'),
    ('calvados', 'brandy'),
    ('pisco', 'brandy'),
    ('grappa', 'brandy'),

    ('triple-sec', 'orange-liqueur'),
    ('cointreau', 'orange-liqueur'),
    ('dry-curacao', 'orange-liqueur'),
    ('grand-marnier', 'orange-liqueur'),
    ('blue-curacao', 'orange-liqueur'),

    ('campari', 'amaro'),
    ('aperol', 'amaro'),
    ('fernet-branca', 'amaro'),
    ('averna', 'amaro'),
    ('montenegro', 'amaro'),
    ('cynar', 'amaro'),
    ('nonino', 'amaro'),

    ('dry-vermouth', 'vermouth'),
    ('sweet-vermouth', 'vermouth'),
    ('blanc-vermouth', 'vermouth'),

    ('fino-sherry', 'sherry'),
    ('amontillado-sherry', 'sherry'),
    ('oloroso-sherry', 'sherry'),
    ('pedro-ximenez', 'sherry'),
    ('tawny-port', 'port'),
    ('ruby-port', 'port'),

    ('champagne', 'sparkling-wine'),
    ('prosecco', 'sparkling-wine'),
    ('cremant', 'sparkling-wine'),

    ('angostura-bitters', 'bitters'),
    ('orange-bitters', 'bitters'),
    ('peychauds-bitters', 'bitters'),
    ('chocolate-bitters', 'bitters'),
    ('grapefruit-bitters', 'bitters'),
    ('celery-bitters', 'bitters'),
    ('lavender-bitters', 'bitters'),
    ('cardamom-bitters', 'bitters')
)
update public.ingredients c
set parent_id = p.id
from rel
join public.ingredients p on p.slug = rel.parent_slug
where c.slug = rel.child_slug;
