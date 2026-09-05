export type GroceryItem = {
  id: string;
  name: string;
  qty: string;
  category: string;
  checked: boolean;
  inInventory?: boolean;
  shopTier?: ShopTier;
  source: string;
};

export type ShopTier = 'weekend' | 'top-up' | 'long-term';

export const shoppingTiers: { id: ShopTier; label: string; description: string }[] = [
  { id: 'weekend', label: 'Weekend shop', description: 'Main shop for the next 7–10 days.' },
  { id: 'top-up', label: 'Top-up', description: 'Fresh items for the midweek trip.' },
  { id: 'long-term', label: 'Long-term staples', description: 'Useful later; not required to get started.' },
];

export type ShoppingItem = Pick<GroceryItem, 'name' | 'qty' | 'category'>;

export type Recipe = {
  id: string;
  title: string;
  category: string;
  symbol: string;
  time: string;
  servings: string;
  description: string;
  ingredients: string[];
  shopping: ShoppingItem[];
  matchGroups?: string[][];
  provenClassic?: boolean;
  steps: string[];
  note?: string;
  userCreated?: boolean;
};

export const categories = [
  'Proteins & dairy',
  'Produce',
  'Bread, grains & starches',
  'Pantry & meal builders',
  'Low-effort backups',
  'Snacks & treats',
  'Drinks',
  'Paper & storage',
  'Cleaning & laundry',
  'Other',
];

export const inventoryCategories = categories.filter((category) => !['Paper & storage', 'Cleaning & laundry'].includes(category));

export const recipes: Recipe[] = [
  {
    id: 'citrus-seltzer', title: 'Tangy Citrus Seltzer', category: 'Drinks', symbol: 'FZ', time: '2 min', servings: '1 drink',
    description: 'A cold sparkling drink with a sharp citrus flavor.',
    ingredients: ['2 oz cold orange juice', '12–16 oz very cold plain or lime sparkling water', 'Ice', 'Optional: 1 lime wedge for more bite'],
    shopping: [
      { name: 'Orange juice', qty: '1 bottle', category: 'Drinks' },
      { name: 'Plain or lime sparkling water', qty: '1 12-pack', category: 'Drinks' },
      { name: 'Limes', qty: '3–4', category: 'Produce' },
    ],
    matchGroups: [['Orange juice'], ['Plain or lime sparkling water']],
    steps: ['Fill a large glass with ice and pour in the orange juice.', 'Slowly top with sparkling water so it does not foam over.', 'Taste, then squeeze in lime for more tang.'],
  },
  {
    id: 'beef-tempeh-tacos', title: 'Beef or Tempeh Tacos', category: 'Dinner', symbol: 'TC', time: '25 min', servings: '4 servings',
    description: 'A flexible meal with salsa, cheese, and a choice of beef or tempeh.',
    ingredients: ['1 lb ground beef or 1 package tempeh', '1 onion', 'Taco seasoning', 'Flour tortillas', 'Shredded lettuce', 'Tomatoes', 'Cheese', 'Salsa'],
    shopping: [
      { name: 'Ground beef', qty: '1 lb', category: 'Proteins & dairy' }, { name: 'Tempeh', qty: '1 package', category: 'Proteins & dairy' },
      { name: 'Onions', qty: '2', category: 'Produce' }, { name: 'Flour tortillas', qty: '1 package', category: 'Bread, grains & starches' },
      { name: 'Romaine or shredded lettuce', qty: '1 package', category: 'Produce' }, { name: 'Tomatoes', qty: '3–4', category: 'Produce' },
      { name: 'Sharp cheddar or Mexican-blend cheese', qty: '1 bag', category: 'Proteins & dairy' }, { name: 'Salsa', qty: '1 jar', category: 'Pantry & meal builders' },
      { name: 'Taco seasoning', qty: '1 packet', category: 'Pantry & meal builders' },
    ],
    matchGroups: [['Ground beef', 'Tempeh'], ['Flour tortillas'], ['Salsa'], ['Sharp cheddar or Mexican-blend cheese']],
    steps: ['Dice the onion and tomatoes.', 'Brown the beef to 160°F, or crumble and crisp the tempeh in a little oil.', 'Add onion and taco seasoning; cook until the onion softens.', 'Build tacos with lettuce, tomato, cheese, and salsa.'],
    note: 'Pick beef or tempeh for the week—you do not need to buy both every trip.',
  },
  {
    id: 'tomato-garlic-shells', title: 'Tomato-Garlic Pasta', category: 'Dinner', symbol: 'PS', time: '30 min', servings: '3–4 servings',
    description: 'A batch-friendly pasta that works with ground beef, tempeh, or no added protein.',
    ingredients: ['8 oz dry pasta', '½–1 lb ground beef or crumbled tempeh', '1 can diced tomatoes', '1–2 tbsp tomato paste', 'Minced garlic', 'Broccoli or frozen vegetables', 'Black pepper and Italian seasoning'],
    shopping: [
      { name: 'Dry pasta', qty: '1 box', category: 'Bread, grains & starches' }, { name: 'Diced tomatoes', qty: '2 cans', category: 'Pantry & meal builders' },
      { name: 'Tomato paste', qty: '2 small cans', category: 'Pantry & meal builders' }, { name: 'Minced garlic', qty: '1 jar', category: 'Produce' },
      { name: 'Frozen vegetables', qty: '2 bags', category: 'Produce' },
    ],
    matchGroups: [['Dry pasta'], ['Diced tomatoes'], ['Tomato paste'], ['Ground beef', 'Tempeh'], ['Frozen vegetables']],
    steps: ['Boil the pasta according to the package and reserve a little pasta water.', 'Brown the beef to 160°F, or crisp crumbled tempeh.', 'Add tomatoes, tomato paste, garlic, seasoning, and vegetables; simmer 10 minutes.', 'Fold in the pasta, loosening with pasta water if needed.'],
  },
  {
    id: 'sheet-pan-protein', title: 'Sheet-Pan Lemon Pepper Dinner', category: 'Dinner', symbol: 'SP', time: '35 min', servings: '2–3 servings',
    description: 'Chicken or salmon with potatoes and green vegetables, cooked with very little cleanup.',
    ingredients: ['Chicken breasts/thighs or 2 salmon fillets', 'Breakfast potatoes or chopped potatoes', 'Broccoli or asparagus', 'Cooking oil', 'Lemon pepper and garlic powder'],
    shopping: [
      { name: 'Chicken breasts or thighs', qty: '1–1½ lb', category: 'Proteins & dairy' }, { name: 'Salmon fillets', qty: '2', category: 'Proteins & dairy' },
      { name: 'Broccoli or asparagus', qty: '1 bunch or bag', category: 'Produce' }, { name: 'Breakfast potatoes or instant mashed potatoes', qty: '1 package', category: 'Bread, grains & starches' },
      { name: 'Lemon pepper seasoning', qty: '1 jar', category: 'Pantry & meal builders' },
    ],
    matchGroups: [['Chicken breasts or thighs', 'Salmon fillets'], ['Breakfast potatoes or instant mashed potatoes'], ['Broccoli or asparagus'], ['Lemon pepper seasoning']],
    steps: ['Heat the oven to 425°F and oil a lined sheet pan.', 'Season and roast potatoes for about 15 minutes.', 'Add the vegetables and chosen protein, then continue roasting until done.', 'Check chicken at 165°F or fish at 145°F before serving.'],
    note: 'Choose chicken or salmon for a given trip. The list keeps both options so you can rotate them.',
  },
  {
    id: 'breakfast-hash', title: 'Cheesy Breakfast Hash', category: 'Breakfast', symbol: 'BH', time: '18 min', servings: '2 servings',
    description: 'Crispy potatoes, eggs, cheddar, and salsa for breakfast—or a dependable dinner.',
    ingredients: ['2 cups frozen breakfast potatoes', '4 eggs', '½ cup shredded cheese', 'Salsa', 'Optional: crumbled tempeh'],
    shopping: [
      { name: 'Eggs', qty: '1 dozen', category: 'Proteins & dairy' }, { name: 'Breakfast potatoes or instant mashed potatoes', qty: '1 package', category: 'Bread, grains & starches' },
      { name: 'Sharp cheddar or Mexican-blend cheese', qty: '1 bag', category: 'Proteins & dairy' }, { name: 'Salsa', qty: '1 jar', category: 'Pantry & meal builders' },
    ],
    matchGroups: [['Eggs'], ['Breakfast potatoes or instant mashed potatoes'], ['Sharp cheddar or Mexican-blend cheese'], ['Salsa']],
    steps: ['Brown the potatoes in a wide skillet until crisp.', 'Make four wells and crack in the eggs.', 'Cover and cook until the eggs reach your preferred doneness.', 'Top with cheese and salsa; add pre-crisped tempeh if wanted.'],
  },
  {
    id: 'upgraded-ramen', title: 'Upgraded Emergency Ramen', category: 'Quick meal', symbol: 'RM', time: '10 min', servings: '1 serving',
    description: 'The familiar backup meal, made more complete with protein and a vegetable.',
    ingredients: ['1 ramen packet or bowl', '1 egg or cooked tempeh/chicken', '1 cup frozen broccoli or mixed vegetables', 'Optional: salsa or chili oil', 'Start with ½ the seasoning packet'],
    shopping: [
      { name: 'Ramen packets or bowls', qty: '4–6', category: 'Bread, grains & starches' }, { name: 'Eggs', qty: '1 dozen', category: 'Proteins & dairy' },
      { name: 'Frozen vegetables', qty: '2 bags', category: 'Produce' },
    ],
    matchGroups: [['Ramen packets or bowls'], ['Eggs', 'Tempeh', 'Chicken breasts or thighs'], ['Frozen vegetables']],
    steps: ['Bring the cooking water to a simmer and add frozen vegetables.', 'Add noodles and cook according to the package.', 'Add an egg during the final two minutes, or stir in cooked tempeh or chicken.', 'Begin with half the seasoning packet, taste, and add more only if needed.'],
    note: 'Using less of the seasoning packet helps keep this from becoming an especially salty meal.',
  },
  {
    id: 'classic-burgers', title: 'Classic Skillet Burgers', category: 'American classics', symbol: 'BG', time: '25 min', servings: '4 burgers', provenClassic: true,
    description: 'Simple beef burgers cooked in a skillet or on a grill with cheese and familiar toppings.',
    ingredients: ['1 lb ground beef', '4 hamburger buns', '4 slices cheddar', 'Salt and black pepper', 'Optional: onion, lettuce, tomato, pickles, ketchup, and mayonnaise'],
    shopping: [
      { name: 'Ground beef', qty: '1 lb', category: 'Proteins & dairy' }, { name: 'Hamburger buns', qty: '1 package', category: 'Bread, grains & starches' },
      { name: 'Sharp cheddar or Mexican-blend cheese', qty: '1 bag', category: 'Proteins & dairy' }, { name: 'Onions', qty: '2', category: 'Produce' },
      { name: 'Romaine or shredded lettuce', qty: '1 package', category: 'Produce' }, { name: 'Tomatoes', qty: '3–4', category: 'Produce' },
      { name: 'Ketchup', qty: '1 bottle', category: 'Pantry & meal builders' }, { name: 'Mayonnaise', qty: '1 jar', category: 'Pantry & meal builders' },
    ],
    matchGroups: [['Ground beef'], ['Hamburger buns'], ['Sharp cheddar or Mexican-blend cheese']],
    steps: ['Divide the beef into four loose patties slightly wider than the buns; press a shallow dent in each center.', 'Season both sides with salt and pepper.', 'Cook in a hot skillet or on a grill for about 3–5 minutes per side, until the centers reach 160°F.', 'Add cheese during the final minute, then serve on buns with the toppings you want.'],
    note: 'Keep the patties loosely formed and avoid pressing them while they cook so they stay juicier.',
  },
  {
    id: 'stovetop-mac-cheese', title: 'Stovetop Mac and Cheese', category: 'American classics', symbol: 'MC', time: '25 min', servings: '4 servings', provenClassic: true,
    description: 'Creamy macaroni and cheddar made in one saucepan after the pasta drains.',
    ingredients: ['8 oz elbow macaroni', '2 tbsp butter', '2 tbsp flour', '1½ cups milk', '2 cups shredded cheddar', 'Salt, pepper, and optional mustard powder'],
    shopping: [
      { name: 'Elbow macaroni', qty: '1 box', category: 'Bread, grains & starches' }, { name: 'Butter', qty: '1 package', category: 'Proteins & dairy' },
      { name: 'All-purpose flour', qty: '1 bag', category: 'Pantry & meal builders' }, { name: 'Milk', qty: '1 carton', category: 'Proteins & dairy' },
      { name: 'Sharp cheddar or Mexican-blend cheese', qty: '1 bag', category: 'Proteins & dairy' },
    ],
    matchGroups: [['Elbow macaroni'], ['Butter'], ['All-purpose flour'], ['Milk'], ['Sharp cheddar or Mexican-blend cheese']],
    steps: ['Boil and drain the macaroni.', 'Melt butter in the same pot, stir in flour, and cook for 1 minute.', 'Whisk in milk and simmer until slightly thickened.', 'Turn off the heat, stir in cheese, then fold in the macaroni and season.'],
    note: 'Proven-classic selection: homemade mac and cheese appears among Allrecipes’ long-running most-viewed recipes.',
  },
  {
    id: 'biscuit-chicken-pot-pie', title: 'Biscuit Chicken Pot Pie', category: 'American classics', symbol: 'CP', time: '40 min', servings: '4 servings', provenClassic: true,
    description: 'A low-effort chicken pot pie using frozen vegetables and refrigerated biscuits.',
    ingredients: ['2 cups cooked chicken', '1 bag frozen mixed vegetables', '1 can cream of chicken soup', '½ cup milk', '1 tube refrigerated biscuits', 'Black pepper and garlic powder'],
    shopping: [
      { name: 'Chicken breasts or thighs', qty: '1–1½ lb', category: 'Proteins & dairy' }, { name: 'Frozen vegetables', qty: '2 bags', category: 'Produce' },
      { name: 'Cream of chicken soup', qty: '1 can', category: 'Pantry & meal builders' }, { name: 'Milk', qty: '1 carton', category: 'Proteins & dairy' },
      { name: 'Refrigerated biscuits', qty: '1 tube', category: 'Bread, grains & starches' },
    ],
    matchGroups: [['Chicken breasts or thighs'], ['Frozen vegetables'], ['Cream of chicken soup'], ['Milk'], ['Refrigerated biscuits']],
    steps: ['Heat the oven to 400°F.', 'Mix cooked chicken, vegetables, soup, milk, and seasoning in a baking dish.', 'Bake 15 minutes, stir, then arrange biscuits on top.', 'Bake until the biscuits are browned and the filling bubbles, about 15–20 minutes more.'],
    note: 'Chicken pot pie is one of Allrecipes’ most-viewed recipes; the biscuit topping keeps this version practical for a weeknight.',
  },
  {
    id: 'slow-cooker-beef-stew', title: 'Slow-Cooker Beef Stew', category: 'American classics', symbol: 'BS', time: '8 hr 20 min', servings: '6 servings', provenClassic: true,
    description: 'Beef, potatoes, carrots, and onion cooked until tender with minimal active work.',
    ingredients: ['2 lb beef stew meat', '1½ lb potatoes', '4 carrots', '1 onion', '3 cups beef broth', '2 tbsp tomato paste', 'Flour, salt, pepper, and garlic powder'],
    shopping: [
      { name: 'Beef stew meat', qty: '2 lb', category: 'Proteins & dairy' }, { name: 'Potatoes', qty: '1½ lb', category: 'Produce' },
      { name: 'Carrots', qty: '1 bag', category: 'Produce' }, { name: 'Onions', qty: '2', category: 'Produce' },
      { name: 'Chicken or beef Better Than Bouillon', qty: '1 jar', category: 'Pantry & meal builders' }, { name: 'Tomato paste', qty: '2 small cans', category: 'Pantry & meal builders' },
    ],
    matchGroups: [['Beef stew meat'], ['Potatoes'], ['Carrots'], ['Onions'], ['Chicken or beef Better Than Bouillon'], ['Tomato paste']],
    steps: ['Cut the vegetables into large pieces.', 'Season the beef and toss it with 2 tablespoons flour.', 'Put everything in the slow cooker with enough prepared broth to mostly cover.', 'Cook on Low for 8 hours or High for 4–5 hours, until the beef and vegetables are tender.'],
    note: 'Slow-cooker beef stew appears among Allrecipes’ long-running most-viewed recipes.',
  },
  {
    id: 'old-fashioned-pancakes', title: 'Old-Fashioned Pancakes', category: 'American classics', symbol: 'PK', time: '20 min', servings: '8 pancakes', provenClassic: true,
    description: 'A dependable small-batch pancake recipe using ordinary baking staples.',
    ingredients: ['1½ cups flour', '1 tbsp baking powder', '1 tbsp sugar', '1¼ cups milk', '1 egg', '3 tbsp melted butter', 'Pinch of salt'],
    shopping: [
      { name: 'All-purpose flour', qty: '1 bag', category: 'Pantry & meal builders' }, { name: 'Baking powder', qty: '1 can', category: 'Pantry & meal builders' },
      { name: 'Sugar', qty: '1 bag', category: 'Pantry & meal builders' }, { name: 'Milk', qty: '1 carton', category: 'Proteins & dairy' },
      { name: 'Eggs', qty: '1 dozen', category: 'Proteins & dairy' }, { name: 'Butter', qty: '1 package', category: 'Proteins & dairy' },
    ],
    matchGroups: [['All-purpose flour'], ['Baking powder'], ['Sugar'], ['Milk'], ['Eggs'], ['Butter']],
    steps: ['Whisk the dry ingredients together.', 'Whisk milk, egg, and melted butter separately, then stir into the dry ingredients just until combined.', 'Cook ¼-cup portions on a lightly buttered skillet over medium heat.', 'Flip when bubbles form and the edges look set; cook until golden.'],
    note: 'Old-fashioned pancakes rank first on Allrecipes’ published list of its most-viewed recipes over time.',
  },
];

const starterTuples: [string, string, string, string?][] = [
  ['Ground beef','1 lb','Proteins & dairy'], ['Chicken breasts or thighs','1–1½ lb','Proteins & dairy'], ['Salmon fillets','2 fillets','Proteins & dairy'], ['Tempeh','1 package','Proteins & dairy'], ['Eggs','1 dozen','Proteins & dairy'], ['Deli turkey, ham, or salami','½ lb','Proteins & dairy'], ['Sharp cheddar or Mexican-blend cheese','1 bag','Proteins & dairy'], ['Milk','1 carton','Proteins & dairy'], ['Greek yogurt','4 cups','Proteins & dairy'], ['Cream cheese','1 package','Proteins & dairy'],
  ['Romaine or shredded lettuce','1 package','Produce'], ['Tomatoes','3–4','Produce'], ['Onions','2','Produce'], ['Broccoli or asparagus','1 bunch or bag','Produce'], ['Bananas, peaches, or precut fruit','7–10 servings','Produce'], ['Minced garlic','1 jar','Produce'], ['Limes','3–4','Produce'], ['Frozen vegetables','2 bags','Produce'],
  ['Flour tortillas','1 package','Bread, grains & starches'], ['Sandwich rolls','1 package','Bread, grains & starches'], ['Bagels','1 package','Bread, grains & starches'], ['Dry pasta','1 box','Bread, grains & starches'], ['Rice','1 bag','Bread, grains & starches'], ['Breakfast potatoes or instant mashed potatoes','1 package','Bread, grains & starches'], ['Breakfast cereal','1 box','Bread, grains & starches'], ['Ramen packets or bowls','4–6','Bread, grains & starches'],
  ['Diced tomatoes','2 cans','Pantry & meal builders'], ['Tomato paste','2 small cans','Pantry & meal builders'], ['Salsa','1 jar','Pantry & meal builders'], ['Chicken or beef Better Than Bouillon','1 jar','Pantry & meal builders'], ['Mayonnaise','1 jar','Pantry & meal builders'], ['Cooking oil','1 bottle','Pantry & meal builders'], ['Hearty canned soup','2–3 cans','Pantry & meal builders'], ['Taco seasoning','1 packet','Pantry & meal builders'], ['Lemon pepper seasoning','1 jar','Pantry & meal builders'],
  ['Frozen dumplings','1 bag','Low-effort backups'], ['Frozen pizza','1','Low-effort backups'], ['Prepared dinner','1–2','Low-effort backups'], ['Prepared chicken wings','1 tray','Low-effort backups'], ['Frozen chicken fried rice','1 bag','Low-effort backups'],
  ['Tortilla chips','1 bag','Snacks & treats'], ['Ritz crackers or chewy bars','1 package','Snacks & treats'], ['Mochi, ice cream, or bakery dessert','Choose 1','Snacks & treats'],
  ['Coffee or tea','1 package','Drinks'], ['Sports drinks','1 pack','Drinks'], ['Mineral water','1 pack','Drinks'], ['Plain or lime sparkling water','1 12-pack','Drinks'], ['Orange juice','1 bottle','Drinks'],
  ['Paper towels','1 pack','Paper & storage','Household essentials'], ['Toilet paper','1 pack','Paper & storage','Household essentials'], ['Quart zipper storage bags','1 box','Paper & storage','Household essentials'], ['Gallon freezer bags','1 box','Paper & storage','Household essentials'], ['13-gallon kitchen trash bags','1 box','Paper & storage','Household essentials'], ['Parchment paper or aluminum foil','1 roll','Paper & storage','Household essentials'],
  ['Dish soap or dishwasher detergent','1','Cleaning & laundry','Household essentials'], ['Hand soap','1 bottle or refill','Cleaning & laundry','Household essentials'], ['Laundry detergent','1 bottle','Cleaning & laundry','Household essentials'], ['All-purpose cleaner','1 bottle','Cleaning & laundry','Household essentials'],
  ['Hamburger buns','1 package','Bread, grains & starches','Base recipe pantry'], ['Ketchup','1 bottle','Pantry & meal builders','Base recipe pantry'], ['Elbow macaroni','1 box','Bread, grains & starches','Base recipe pantry'], ['Butter','1 package','Proteins & dairy','Base recipe pantry'], ['All-purpose flour','1 bag','Pantry & meal builders','Base recipe pantry'],
  ['Cream of chicken soup','1 can','Pantry & meal builders','Base recipe pantry'], ['Refrigerated biscuits','1 tube','Bread, grains & starches','Base recipe pantry'], ['Beef stew meat','2 lb','Proteins & dairy','Base recipe pantry'], ['Potatoes','1½ lb','Produce','Base recipe pantry'], ['Carrots','1 bag','Produce','Base recipe pantry'],
  ['Baking powder','1 can','Pantry & meal builders','Base recipe pantry'], ['Sugar','1 bag','Pantry & meal builders','Base recipe pantry'], ['Salt','1 canister','Pantry & meal builders','Base recipe pantry'], ['Black pepper','1 grinder or shaker','Pantry & meal builders','Base recipe pantry'], ['Garlic powder','1 jar','Pantry & meal builders','Base recipe pantry'],
  ['Italian seasoning','1 jar','Pantry & meal builders','Base recipe pantry'], ['Mustard powder','1 jar','Pantry & meal builders','Base recipe pantry'], ['Chili oil','1 bottle','Pantry & meal builders','Base recipe pantry'], ['Pickles','1 jar','Pantry & meal builders','Base recipe pantry'],
];

export function inferShopTier(item: Pick<GroceryItem, 'name' | 'category' | 'source'>): ShopTier {
  const itemName = normalize(item.name);
  const topUpItems = new Set([
    'deli turkey ham or salami',
    'greek yogurt',
    'romaine or shredded lettuce',
    'tomatoes',
    'broccoli or asparagus',
    'bananas peaches or precut fruit',
    'bagels',
  ]);
  if (topUpItems.has(itemName)) return 'top-up';

  const longTermItems = new Set([
    'dry pasta',
    'rice',
    'diced tomatoes',
    'tomato paste',
    'chicken or beef better than bouillon',
    'orange juice',
    'elbow macaroni',
    'all purpose flour',
    'cream of chicken soup',
    'baking powder',
    'sugar',
    'italian seasoning',
    'mustard powder',
    'chili oil',
  ]);
  if (['Paper & storage', 'Cleaning & laundry'].includes(item.category) || longTermItems.has(itemName)) return 'long-term';
  return 'weekend';
}

export const starterItems: GroceryItem[] = starterTuples.map(([name, qty, category, source], index) => ({
  id: `starter-${index}`,
  name,
  qty,
  category,
  checked: false,
  inInventory: false,
  source: source ?? 'Starter list',
  shopTier: inferShopTier({ name, category, source: source ?? 'Starter list' }),
}));

export const bagelItem = starterItems.find((item) => item.name === 'Bagels')!;
export const recipePantryItems = starterItems.filter((item) => item.source === 'Base recipe pantry');

export function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
