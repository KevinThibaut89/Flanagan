-- Widening the drinks vocabulary past the Anglo-American bar. The trigger was
-- mastiha: with no row for it a bottle gets no canonical id, and an ingredient
-- with no id is invisible to search, to the base-spirit facet, and to "can I
-- make this?". The same hole swallowed ouzo, rakı, pálinka, sake and cider.
--
-- Same conventions as 20260816120700_seed_ingredients.sql, which this file
-- extends rather than replaces (that migration is applied; it is never edited):
--
--   * Parenting rule — a child must be a *valid substitute* for its parent,
--     because makeability walks the chain upward and every ancestor it reaches
--     is treated as available. Where substitution would be a lie the row stands
--     alone, as `mezcal` and `pimms` already do.
--   * Only slugs introduced by this file appear in the wiring block below. No
--     existing row is re-parented: that would move the base-spirit facet under
--     recipes people have already written.
--   * Nothing here is a staple. The Staples screen earns its keep by being
--     short.
--   * Accented names need no de-accented alias — search folds diacritics. The
--     exceptions are characters NFD does not decompose, so Rakı carries "raki".

insert into public.ingredients (slug, name, kind, aliases, is_staple, sort_order) values
  -- ── Gin ──────────────────────────────────────────────────────────────────
  ('contemporary-gin',    'Contemporary gin',     'spirit', '{"new western gin","new american gin"}', false, 11),
  ('barrel-aged-gin',     'Barrel-aged gin',      'spirit', '{"aged gin"}', false, 11),

  -- ── Vodka ────────────────────────────────────────────────────────────────
  ('flavoured-vodka',     'Flavoured vodka',      'spirit', '{"flavored vodka"}', false, 21),
  ('citron-vodka',        'Citron vodka',         'spirit', '{"citrus vodka","lemon vodka"}', false, 21),
  ('pepper-vodka',        'Pepper vodka',         'spirit', '{"peppar vodka","chilli vodka"}', false, 21),
  ('bison-grass-vodka',   'Bison grass vodka',    'spirit', '{"żubrówka","zubrowka"}', false, 21),

  -- ── Whisky, wider ────────────────────────────────────────────────────────
  ('speyside-scotch',     'Speyside Scotch',      'spirit', '{}', false, 33),
  ('highland-scotch',     'Highland Scotch',      'spirit', '{}', false, 33),
  ('lowland-scotch',      'Lowland Scotch',       'spirit', '{}', false, 33),
  ('campbeltown-scotch',  'Campbeltown Scotch',   'spirit', '{}', false, 33),
  ('blended-malt-whisky', 'Blended malt whisky',  'spirit', '{"vatted malt"}', false, 33),
  ('single-grain-whisky', 'Single grain whisky',  'spirit', '{"grain whisky"}', false, 33),
  ('bonded-bourbon',      'Bottled-in-bond bourbon', 'spirit', '{"bonded bourbon"}', false, 33),
  ('corn-whiskey',        'Corn whiskey',         'spirit', '{"moonshine","white dog"}', false, 33),
  ('wheat-whiskey',       'Wheat whiskey',        'spirit', '{}', false, 33),
  ('indian-whisky',       'Indian whisky',        'spirit', '{}', false, 33),
  ('taiwanese-whisky',    'Taiwanese whisky',     'spirit', '{}', false, 33),
  ('english-whisky',      'English whisky',       'spirit', '{}', false, 33),
  ('australian-whisky',   'Australian whisky',    'spirit', '{}', false, 33),

  -- ── Rum, by origin ───────────────────────────────────────────────────────
  ('demerara-rum',        'Demerara rum',         'spirit', '{"guyanese rum"}', false, 43),
  ('barbadian-rum',       'Barbadian rum',        'spirit', '{"bajan rum"}', false, 43),
  ('cuban-rum',           'Cuban rum',            'spirit', '{"ron cubano"}', false, 43),
  ('navy-rum',            'Navy rum',             'spirit', '{"navy strength rum"}', false, 43),
  ('blackstrap-rum',      'Blackstrap rum',       'spirit', '{}', false, 43),
  ('clairin',             'Clairin',              'spirit', '{"haitian rum"}', false, 43),
  ('rhum-agricole-blanc', 'Rhum agricole blanc',  'spirit', '{"white agricole"}', false, 43),
  ('rhum-agricole-vieux', 'Rhum agricole vieux',  'spirit', '{"aged agricole"}', false, 43),

  -- ── Agave & the desert spirits ───────────────────────────────────────────
  ('cristalino-tequila',  'Cristalino tequila',   'spirit', '{}', false, 51),
  ('extra-anejo-tequila', 'Extra Añejo tequila',  'spirit', '{"extra anejo"}', false, 51),
  ('espadin-mezcal',      'Espadín mezcal',       'spirit', '{}', false, 52),
  ('tobala-mezcal',       'Tobalá mezcal',        'spirit', '{}', false, 52),
  -- Sotol is not even made from agave, and raicilla and bacanora are no more
  -- interchangeable with tequila than mezcal is. All three stand alone.
  ('sotol',               'Sotol',                'spirit', '{}', false, 53),
  ('raicilla',            'Raicilla',             'spirit', '{}', false, 53),
  ('bacanora',            'Bacanora',             'spirit', '{}', false, 53),

  -- ── Brandy ───────────────────────────────────────────────────────────────
  ('brandy-de-jerez',     'Brandy de Jerez',      'spirit', '{"spanish brandy"}', false, 61),
  ('applejack',           'Applejack',            'spirit', '{}', false, 61),
  -- Sweetened and aromatised, so not a stand-in for a measure of cognac.
  ('metaxa',              'Metaxa',               'spirit', '{}', false, 62),

  -- ── Anise ────────────────────────────────────────────────────────────────
  -- Clustered by sort order, deliberately not by a shared parent: absinthe at
  -- 68%, sweet sambuca and unsweetened arak do not stand in for one another.
  ('ouzo',                'Ouzo',                 'spirit', '{}', false, 71),
  ('raki',                'Rakı',                 'spirit', '{"raki"}', false, 71),
  ('arak',                'Arak',                 'spirit', '{"araq"}', false, 71),
  ('aguardiente',         'Aguardiente',          'spirit', '{"guaro"}', false, 71),
  ('herbsaint',           'Herbsaint',            'spirit', '{}', false, 71),

  -- ── Nordic ───────────────────────────────────────────────────────────────
  ('brennivin',           'Brennivín',            'spirit', '{"black death"}', false, 72),
  ('linie-aquavit',       'Linie aquavit',        'spirit', '{}', false, 72),

  -- ── Eau-de-vie ───────────────────────────────────────────────────────────
  -- A root of its own, NOT a child of brandy: a bottle of kirsch must not make
  -- a Sidecar report as makeable.
  ('eau-de-vie',          'Eau-de-vie',           'spirit', '{"fruit brandy","clear fruit brandy"}', false, 73),
  ('kirsch',              'Kirsch',               'spirit', '{"kirschwasser"}', false, 74),
  ('poire-williams',      'Poire Williams',       'spirit', '{"williams pear brandy","pear brandy"}', false, 74),
  ('framboise',           'Framboise eau-de-vie', 'spirit', '{"raspberry brandy"}', false, 74),
  ('mirabelle',           'Mirabelle',            'spirit', '{}', false, 74),
  ('quetsche',            'Quetsche',             'spirit', '{"quetsch"}', false, 74),
  ('slivovitz',           'Slivovitz',            'spirit', '{"slivovica","sljivovica","plum brandy"}', false, 74),
  ('palinka',             'Pálinka',              'spirit', '{}', false, 74),
  ('rakia',               'Rakia',                'spirit', '{"rakija"}', false, 74),
  ('obstler',             'Obstler',              'spirit', '{"obstbrand"}', false, 74),

  -- ── Pomace ───────────────────────────────────────────────────────────────
  ('marc',                'Marc',                 'spirit', '{"marc de bourgogne"}', false, 75),
  ('orujo',               'Orujo',                'spirit', '{}', false, 75),
  ('tsipouro',            'Tsipouro',             'spirit', '{"tsikoudia"}', false, 75),

  -- ── Rice & grain ─────────────────────────────────────────────────────────
  ('soju',                'Soju',                 'spirit', '{}', false, 76),
  ('shochu',              'Shochu',               'spirit', '{"shōchū"}', false, 76),
  ('awamori',             'Awamori',              'spirit', '{}', false, 76),
  ('baijiu',              'Baijiu',               'spirit', '{"white liquor"}', false, 76),
  ('korn',                'Korn',                 'spirit', '{"doppelkorn"}', false, 76),

  -- ── Cane, palm & elsewhere ───────────────────────────────────────────────
  ('batavia-arrack',      'Batavia arrack',       'spirit', '{}', false, 77),
  ('ceylon-arrack',       'Ceylon arrack',        'spirit', '{"coconut arrack"}', false, 77),
  ('feni',                'Feni',                 'spirit', '{"fenny"}', false, 77),
  ('singani',             'Singani',              'spirit', '{}', false, 77),
  ('poitin',              'Poitín',               'spirit', '{"poteen","potcheen"}', false, 77),

  -- ── Orange liqueurs ──────────────────────────────────────────────────────
  ('mandarine-napoleon',  'Mandarine Napoléon',   'liqueur', '{}', false, 101),

  -- ── Floral liqueurs ──────────────────────────────────────────────────────
  ('hibiscus-liqueur',    'Hibiscus liqueur',     'liqueur', '{}', false, 110),
  ('parfait-amour',       'Parfait Amour',        'liqueur', '{}', false, 110),

  -- ── Fruit liqueurs ───────────────────────────────────────────────────────
  ('raspberry-liqueur',   'Raspberry liqueur',    'liqueur', '{"creme de framboise"}', false, 112),
  ('chambord',            'Chambord',             'liqueur', '{"black raspberry liqueur"}', false, 112),
  ('strawberry-liqueur',  'Strawberry liqueur',   'liqueur', '{"creme de fraise"}', false, 112),
  ('italicus',            'Italicus',             'liqueur', '{"bergamot liqueur"}', false, 112),
  ('umeshu',              'Umeshu',               'liqueur', '{"plum wine","japanese plum liqueur"}', false, 112),
  ('creme-de-noyaux',     'Crème de noyaux',      'liqueur', '{"noyaux"}', false, 112),
  ('creme-de-pamplemousse','Crème de pamplemousse','liqueur', '{"grapefruit liqueur","pamplemousse"}', false, 112),
  ('pear-liqueur',        'Pear liqueur',         'liqueur', '{"poire liqueur"}', false, 112),
  ('fig-liqueur',         'Fig liqueur',          'liqueur', '{}', false, 112),
  ('pomegranate-liqueur', 'Pomegranate liqueur',  'liqueur', '{"pama"}', false, 112),
  ('coconut-liqueur',     'Coconut liqueur',      'liqueur', '{"malibu"}', false, 112),
  ('mango-liqueur',       'Mango liqueur',        'liqueur', '{}', false, 112),
  ('lychee-liqueur',      'Lychee liqueur',       'liqueur', '{"soho","dita"}', false, 112),
  ('passion-fruit-liqueur','Passion fruit liqueur','liqueur', '{"passoa"}', false, 112),
  ('yuzu-liqueur',        'Yuzu liqueur',         'liqueur', '{}', false, 112),

  -- ── Herbal & resinous liqueurs ───────────────────────────────────────────
  ('mastiha',             'Mastiha',              'liqueur', '{"masticha","mastic liqueur","skinos"}', false, 122),
  ('strega',              'Strega',               'liqueur', '{}', false, 122),
  ('licor-43',            'Licor 43',             'liqueur', '{"cuarenta y tres"}', false, 122),
  ('genepy',              'Génépy',               'liqueur', '{"genepi"}', false, 122),
  ('kummel',              'Kümmel',               'liqueur', '{"kuemmel"}', false, 122),
  ('anisette',            'Anisette',             'liqueur', '{"anis"}', false, 122),
  ('pine-liqueur',        'Pine liqueur',         'liqueur', '{"zirbenz","arolla pine"}', false, 122),
  ('rhubarb-liqueur',     'Rhubarb liqueur',      'liqueur', '{}', false, 122),

  -- ── Nutty & confectionery liqueurs ───────────────────────────────────────
  ('frangelico',          'Frangelico',           'liqueur', '{"hazelnut liqueur"}', false, 123),
  ('nocino',              'Nocino',               'liqueur', '{"walnut liqueur"}', false, 123),
  ('pistachio-liqueur',   'Pistachio liqueur',    'liqueur', '{}', false, 123),
  ('white-creme-de-cacao','White crème de cacao', 'liqueur', '{"creme de cacao blanc"}', false, 123),
  ('dark-creme-de-cacao', 'Dark crème de cacao',  'liqueur', '{"brown creme de cacao"}', false, 123),
  ('chocolate-liqueur',   'Chocolate liqueur',    'liqueur', '{}', false, 123),
  ('advocaat',            'Advocaat',             'liqueur', '{"eierlikör","egg liqueur"}', false, 123),

  -- ── Spice & chilli liqueurs ──────────────────────────────────────────────
  ('ancho-reyes',         'Ancho Reyes',          'liqueur', '{"ancho chile liqueur"}', false, 124),
  ('ancho-reyes-verde',   'Ancho Reyes Verde',    'liqueur', '{"poblano liqueur"}', false, 124),
  ('cinnamon-liqueur',    'Cinnamon liqueur',     'liqueur', '{"fireball","goldschläger"}', false, 124),
  ('ginger-liqueur',      'Ginger liqueur',       'liqueur', '{"domaine de canton"}', false, 124),
  ('honey-liqueur',       'Honey liqueur',        'liqueur', '{"bärenjäger","krupnik"}', false, 124),

  -- ── Punsch & the rest ────────────────────────────────────────────────────
  ('swedish-punsch',      'Swedish punsch',       'liqueur', '{"punsch","caloric punch"}', false, 125),
  ('southern-comfort',    'Southern Comfort',     'liqueur', '{}', false, 125),
  ('vanilla-liqueur',     'Vanilla liqueur',      'liqueur', '{}', false, 125),

  -- ── Red bitter apéritivi ─────────────────────────────────────────────────
  ('select-aperitivo',    'Select Aperitivo',     'amaro', '{"select"}', false, 132),
  ('cappelletti',         'Cappelletti',          'amaro', '{"aperitivo americano rosso"}', false, 132),
  ('contratto-bitter',    'Contratto Bitter',     'amaro', '{}', false, 132),
  ('luxardo-bitter',      'Luxardo Bitter',       'amaro', '{}', false, 132),
  ('gran-classico',       'Gran Classico',        'amaro', '{}', false, 132),

  -- ── Gentian ──────────────────────────────────────────────────────────────
  ('salers',              'Salers',               'amaro', '{"gentiane"}', false, 133),
  ('aveze',               'Avèze',                'amaro', '{}', false, 133),
  ('china-china',         'China-China',          'amaro', '{"bigallet china china"}', false, 133),

  -- ── Alpine & fernet ──────────────────────────────────────────────────────
  ('braulio',             'Braulio',              'amaro', '{}', false, 134),
  ('sfumato',             'Sfumato Rabarbaro',    'amaro', '{"sfumato"}', false, 134),
  ('branca-menta',        'Branca Menta',         'amaro', '{}', false, 134),

  -- ── Amari ────────────────────────────────────────────────────────────────
  ('ramazzotti',          'Amaro Ramazzotti',     'amaro', '{"ramazzotti"}', false, 135),
  ('lucano',              'Amaro Lucano',         'amaro', '{"lucano"}', false, 135),
  ('meletti',             'Amaro Meletti',        'amaro', '{"meletti"}', false, 135),
  -- Distinctive enough that a recipe asking for "amaro" is not served by them.
  ('zucca',               'Rabarbaro Zucca',      'amaro', '{"zucca"}', false, 135),
  ('cardamaro',           'Cardamaro',            'amaro', '{}', false, 135),
  ('becherovka',          'Becherovka',           'amaro', '{}', false, 135),
  ('jagermeister',        'Jägermeister',         'amaro', '{"jager"}', false, 135),
  ('unicum',              'Unicum',               'amaro', '{"zwack"}', false, 135),
  ('underberg',           'Underberg',            'amaro', '{}', false, 135),
  ('gammel-dansk',        'Gammel Dansk',         'amaro', '{}', false, 135),
  ('malort',              'Malört',               'amaro', '{}', false, 135),
  ('amer-picon',          'Amer Picon',           'amaro', '{"picon"}', false, 135),

  -- ── Vermouth & aromatised wine ───────────────────────────────────────────
  ('punt-e-mes',          'Punt e Mes',           'vermouth', '{}', false, 143),
  ('carpano-antica',      'Carpano Antica Formula', 'vermouth', '{"carpano antica"}', false, 143),
  ('vermouth-di-torino',  'Vermouth di Torino',   'vermouth', '{}', false, 143),
  ('cocchi-di-torino',    'Cocchi Vermouth di Torino', 'vermouth', '{"cocchi torino"}', false, 143),
  ('cocchi-rosa',         'Cocchi Rosa',          'vermouth', '{}', false, 143),
  ('lillet-rouge',        'Lillet Rouge',         'vermouth', '{}', false, 143),
  ('lillet-rose',         'Lillet Rosé',          'vermouth', '{}', false, 143),
  ('kina-lillet',         'Kina Lillet',          'vermouth', '{}', false, 143),
  ('bonal',               'Bonal',                'vermouth', '{"bonal gentiane quina"}', false, 143),
  ('byrrh',               'Byrrh',                'vermouth', '{}', false, 143),
  ('barolo-chinato',      'Barolo Chinato',       'vermouth', '{}', false, 143),

  -- ── Fortified wine ───────────────────────────────────────────────────────
  ('palo-cortado',        'Palo Cortado',         'fortified', '{}', false, 154),
  ('cream-sherry',        'Cream sherry',         'fortified', '{}', false, 154),
  ('moscatel-sherry',     'Moscatel sherry',      'fortified', '{"moscatel"}', false, 154),
  ('white-port',          'White port',           'fortified', '{}', false, 154),
  ('rose-port',           'Rosé port',            'fortified', '{"pink port"}', false, 154),
  ('vintage-port',        'Vintage port',         'fortified', '{}', false, 154),
  ('malmsey-madeira',     'Malmsey Madeira',      'fortified', '{"malvasia madeira"}', false, 154),
  ('pineau-des-charentes','Pineau des Charentes', 'fortified', '{"pineau"}', false, 154),
  ('floc-de-gascogne',    'Floc de Gascogne',     'fortified', '{}', false, 154),
  ('vin-santo',           'Vin Santo',            'fortified', '{}', false, 154),
  ('banyuls',             'Banyuls',              'fortified', '{}', false, 154),
  ('commandaria',         'Commandaria',          'fortified', '{}', false, 154),

  -- ── Wine ─────────────────────────────────────────────────────────────────
  ('cava',                'Cava',                 'wine', '{}', false, 161),
  ('orange-wine',         'Orange wine',          'wine', '{"skin contact wine"}', false, 163),

  -- ── Beer ─────────────────────────────────────────────────────────────────
  ('pilsner',             'Pilsner',              'beer', '{}', false, 171),
  ('wheat-beer',          'Wheat beer',           'beer', '{"witbier","hefeweizen"}', false, 171),
  ('pale-ale',            'Pale ale',             'beer', '{}', false, 171),
  ('porter',              'Porter',               'beer', '{}', false, 171),
  ('sour-beer',           'Sour beer',            'beer', '{"gose","berliner weisse"}', false, 171),

  -- ── Sake ─────────────────────────────────────────────────────────────────
  ('sake',                'Sake',                 'sake', '{"nihonshu","rice wine"}', false, 172),
  ('junmai',              'Junmai sake',          'sake', '{"junmai"}', false, 173),
  ('ginjo',               'Ginjo sake',           'sake', '{"ginjo"}', false, 173),
  ('daiginjo',            'Daiginjo sake',        'sake', '{"daiginjo"}', false, 173),
  ('nigori',              'Nigori sake',          'sake', '{"cloudy sake"}', false, 173),
  ('sparkling-sake',      'Sparkling sake',       'sake', '{}', false, 173),
  -- Brewed from rice, but nobody pours it where a recipe asks for sake.
  ('makgeolli',           'Makgeolli',            'sake', '{"korean rice wine"}', false, 173),

  -- ── Cider ────────────────────────────────────────────────────────────────
  ('cider',               'Cider',                'cider', '{"hard cider","apple cider"}', false, 174),
  ('dry-cider',           'Dry cider',            'cider', '{}', false, 175),
  ('sweet-cider',         'Sweet cider',          'cider', '{}', false, 175),
  ('sparkling-cider',     'Sparkling cider',      'cider', '{}', false, 175),
  ('perry',               'Perry',                'cider', '{"pear cider"}', false, 175)
on conflict (slug) do nothing;

-- Parent wiring. Every child_slug below is introduced by this file; no existing
-- row changes parent, so no recipe already written changes the family it files
-- under.
with rel(child_slug, parent_slug) as (
  values
    ('contemporary-gin', 'gin'),
    ('barrel-aged-gin', 'gin'),

    ('flavoured-vodka', 'vodka'),
    ('citron-vodka', 'flavoured-vodka'),
    ('pepper-vodka', 'flavoured-vodka'),
    ('bison-grass-vodka', 'flavoured-vodka'),

    ('speyside-scotch', 'scotch'),
    ('highland-scotch', 'scotch'),
    ('lowland-scotch', 'scotch'),
    ('campbeltown-scotch', 'scotch'),
    ('blended-malt-whisky', 'scotch'),
    ('single-grain-whisky', 'whisky'),
    ('bonded-bourbon', 'bourbon'),
    ('corn-whiskey', 'whisky'),
    ('wheat-whiskey', 'whisky'),
    ('indian-whisky', 'whisky'),
    ('taiwanese-whisky', 'whisky'),
    ('english-whisky', 'whisky'),
    ('australian-whisky', 'whisky'),

    ('demerara-rum', 'rum'),
    ('barbadian-rum', 'rum'),
    ('cuban-rum', 'rum'),
    ('navy-rum', 'rum'),
    ('blackstrap-rum', 'rum'),
    ('clairin', 'rum'),
    ('rhum-agricole-blanc', 'agricole-rhum'),
    ('rhum-agricole-vieux', 'agricole-rhum'),

    ('cristalino-tequila', 'tequila'),
    ('extra-anejo-tequila', 'tequila'),
    ('espadin-mezcal', 'mezcal'),
    ('tobala-mezcal', 'mezcal'),

    ('brandy-de-jerez', 'brandy'),
    ('applejack', 'calvados'),

    ('linie-aquavit', 'aquavit'),

    ('kirsch', 'eau-de-vie'),
    ('poire-williams', 'eau-de-vie'),
    ('framboise', 'eau-de-vie'),
    ('mirabelle', 'eau-de-vie'),
    ('quetsche', 'eau-de-vie'),
    ('slivovitz', 'eau-de-vie'),
    ('palinka', 'eau-de-vie'),
    ('rakia', 'eau-de-vie'),
    ('obstler', 'eau-de-vie'),

    ('mandarine-napoleon', 'orange-liqueur'),

    ('chambord', 'raspberry-liqueur'),
    ('white-creme-de-cacao', 'creme-de-cacao'),
    ('dark-creme-de-cacao', 'creme-de-cacao'),

    ('select-aperitivo', 'amaro'),
    ('cappelletti', 'amaro'),
    ('contratto-bitter', 'amaro'),
    ('luxardo-bitter', 'amaro'),
    ('gran-classico', 'amaro'),
    ('braulio', 'amaro'),
    ('sfumato', 'amaro'),
    ('branca-menta', 'amaro'),
    ('ramazzotti', 'amaro'),
    ('lucano', 'amaro'),
    ('meletti', 'amaro'),

    ('punt-e-mes', 'sweet-vermouth'),
    ('carpano-antica', 'sweet-vermouth'),
    ('vermouth-di-torino', 'sweet-vermouth'),
    ('cocchi-di-torino', 'sweet-vermouth'),

    ('palo-cortado', 'sherry'),
    ('cream-sherry', 'sherry'),
    ('moscatel-sherry', 'sherry'),
    ('white-port', 'port'),
    ('rose-port', 'port'),
    ('vintage-port', 'port'),
    ('malmsey-madeira', 'madeira'),

    ('cava', 'sparkling-wine'),
    ('pilsner', 'lager'),

    ('junmai', 'sake'),
    ('ginjo', 'sake'),
    ('daiginjo', 'sake'),
    ('nigori', 'sake'),
    ('sparkling-sake', 'sake'),

    ('dry-cider', 'cider'),
    ('sweet-cider', 'cider'),
    ('sparkling-cider', 'cider')
)
update public.ingredients c
set parent_id = p.id
from rel
join public.ingredients p on p.slug = rel.parent_slug
where c.slug = rel.child_slug;
