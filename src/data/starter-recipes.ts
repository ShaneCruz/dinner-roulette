import type {
  IngredientInput,
  RecipeInput,
  StoreSection,
  Unit,
} from "@/lib/recipes/schema";

/**
 * Every grocery item the starter recipes use, with its store section and
 * whether it spoils. Keeping one catalog means the same item always has the
 * same name, so the shopping list can merge shared ingredients.
 */
const CATALOG = {
  // Produce
  "yellow onion": ["produce", true],
  "red onion": ["produce", true],
  garlic: ["produce", true],
  carrot: ["produce", true],
  celery: ["produce", true],
  "bell pepper": ["produce", true],
  zucchini: ["produce", true],
  "yellow squash": ["produce", true],
  "roma tomato": ["produce", true],
  "cherry tomato": ["produce", true],
  cucumber: ["produce", true],
  "romaine lettuce": ["produce", true],
  "mixed salad greens": ["produce", true],
  "baby spinach": ["produce", true],
  broccoli: ["produce", true],
  cauliflower: ["produce", true],
  lemon: ["produce", true],
  avocado: ["produce", true],
  "fresh parsley": ["produce", true],
  "fresh basil": ["produce", true],
  "fresh dill": ["produce", true],
  "green onion": ["produce", true],
  "yukon gold potato": ["produce", true],
  "russet potato": ["produce", true],
  "sweet potato": ["produce", true],

  // Meat and deli
  "ground beef": ["meat", true],
  "sweet italian sausage": ["meat", true],
  "hot italian sausage": ["meat", true],
  "boneless skinless chicken breast": ["meat", true],
  "beef chuck roast": ["meat", true],
  "sirloin steak": ["meat", true],
  "flank steak": ["meat", true],
  "bone-in pork chop": ["meat", true],
  "ham steak": ["meat", true],
  "rotisserie chicken": ["deli", true],
  "sliced deli ham": ["deli", true],

  // Dairy and eggs
  "shredded mozzarella": ["dairy", true],
  "grated parmesan": ["dairy", true],
  "shredded cheddar": ["dairy", true],
  "shredded mexican cheese blend": ["dairy", true],
  "sliced cheddar": ["dairy", true],
  "sliced pepper jack": ["dairy", true],
  "ricotta cheese": ["dairy", true],
  "feta cheese": ["dairy", true],
  butter: ["dairy", true],
  "whole milk": ["dairy", true],
  "2% milk": ["dairy", true],
  "heavy cream": ["dairy", true],
  "sour cream": ["dairy", true],
  "plain greek yogurt": ["dairy", true],
  egg: ["dairy", true],
  tzatziki: ["dairy", true],

  // Bakery
  "hoagie roll": ["bakery", true],
  "sandwich bread": ["bakery", true],
  "whole wheat bread": ["bakery", true],
  "pita bread": ["bakery", true],
  "flour tortilla": ["bakery", true],
  "whole wheat tortilla": ["bakery", true],

  // Pantry
  spaghetti: ["pantry", false],
  "mostaccioli pasta": ["pantry", false],
  "whole wheat penne": ["pantry", false],
  "egg noodles": ["pantry", false],
  "long-grain white rice": ["pantry", false],
  "brown rice": ["pantry", false],
  "crushed tomatoes": ["pantry", false],
  "diced tomatoes": ["pantry", false],
  "whole peeled tomatoes": ["pantry", false],
  "tomato paste": ["pantry", false],
  "tomato sauce": ["pantry", false],
  "marinara sauce": ["pantry", false],
  "chicken broth": ["pantry", false],
  "beef broth": ["pantry", false],
  "vegetable broth": ["pantry", false],
  "kidney beans": ["pantry", false],
  "black beans": ["pantry", false],
  "italian breadcrumbs": ["pantry", false],
  "all-purpose flour": ["pantry", false],
  sugar: ["pantry", false],
  "brown sugar": ["pantry", false],
  honey: ["pantry", false],
  "bbq sauce": ["pantry", false],
  "sugar-free bbq sauce": ["pantry", false],
  "worcestershire sauce": ["pantry", false],
  "italian dressing": ["pantry", false],
  "red wine vinaigrette": ["pantry", false],
  salsa: ["pantry", false],
  "hot sauce": ["pantry", false],
  "pickled jalapeño": ["pantry", false],
  "kalamata olive": ["pantry", false],
  "prepared horseradish": ["pantry", false],
  "dry onion soup mix": ["pantry", false],
  "chipotle pepper in adobo": ["international", false],
  "wooden skewer": ["other", false],

  // Spices and oils
  "olive oil": ["spices", false],
  "kosher salt": ["spices", false],
  "black pepper": ["spices", false],
  "italian seasoning": ["spices", false],
  "dried oregano": ["spices", false],
  "dried thyme": ["spices", false],
  "bay leaf": ["spices", false],
  "chili powder": ["spices", false],
  "ground cumin": ["spices", false],
  "smoked paprika": ["spices", false],
  "garlic powder": ["spices", false],
  "cayenne pepper": ["spices", false],
  "red pepper flakes": ["spices", false],
  "chipotle chili powder": ["spices", false],
  "taco seasoning": ["spices", false],

  // Frozen
  "frozen corn": ["frozen", false],
  "cauliflower rice": ["frozen", false],
} as const satisfies Record<string, readonly [StoreSection, boolean]>;

type IngredientName = keyof typeof CATALOG;

/** Builds an ingredient from the catalog so section and perishable stay consistent. */
function ing(
  name: IngredientName,
  quantity: number | null,
  unit: Unit,
  note?: string,
  optional?: boolean,
): IngredientInput {
  const [section, perishable] = CATALOG[name];
  return {
    name,
    quantity,
    unit,
    section,
    perishable,
    ...(note ? { note } : {}),
    ...(optional ? { optional: true } : {}),
  };
}

const salt = () => ing("kosher salt", null, "to_taste");
const pepper = () => ing("black pepper", null, "to_taste");

export const STARTER_RECIPES: RecipeInput[] = [
  // ───────────────────────────── Mains ─────────────────────────────
  {
    slug: "spaghetti-bolognese",
    title: "Spaghetti Bolognese",
    description:
      "A cozy meat sauce that tastes like it simmered all afternoon but is done in about half an hour. Twirling technique is judged by the kids.",
    kind: "main",
    cuisine: "Italian",
    tags: ["pasta", "italian", "kid_favorite"],
    method: "stovetop",
    activeMinutes: 25,
    totalMinutes: 35,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Put red pepper flakes and hot sauce on the table so dad can heat up his own plate.",
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("ground beef", 1.5, "lb"),
      ing("yellow onion", 1, "whole", "finely diced"),
      ing("carrot", 1, "whole", "peeled and finely diced"),
      ing("garlic", 3, "clove", "minced"),
      ing("tomato paste", 2, "tbsp"),
      ing("crushed tomatoes", 1, "can", "28 oz"),
      ing("italian seasoning", 2, "tsp"),
      ing("spaghetti", 1, "lb"),
      ing("olive oil", 1, "tbsp"),
      ing("grated parmesan", 0.5, "cup", "for the table"),
      ing("red pepper flakes", null, "to_taste", "for dad, at the table", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Fill a big pot with water, add 1 tablespoon of salt, cover it, and set it on high heat to boil for the pasta.",
      },
      {
        text: "Meanwhile, heat the olive oil in a large skillet over medium-high heat. Add the onion and carrot and cook, stirring now and then, until soft, about 5 minutes.",
        timerMinutes: 5,
      },
      {
        text: "Add the ground beef. Break it into small crumbles with a wooden spoon and cook until no pink is left, about 7 minutes. If there's a lot of grease, carefully spoon most of it out.",
        timerMinutes: 7,
      },
      {
        text: "Stir in the garlic and tomato paste and cook for 1 minute. Add the crushed tomatoes, Italian seasoning, 1 teaspoon salt, and a few grinds of pepper.",
      },
      {
        text: "Turn the heat to low so the sauce just bubbles gently, and let it simmer for 15 minutes, stirring every few minutes.",
        timerMinutes: 15,
      },
      {
        text: "While the sauce simmers, cook the spaghetti in the boiling water as the package says (about 10 minutes). Before draining, scoop out 1/2 cup of the pasta water with a mug.",
        timerMinutes: 10,
      },
      {
        text: "Drain the pasta and toss it with the sauce. If it looks dry, splash in some of the saved pasta water. Serve with parmesan on top.",
      },
    ],
    variants: [
      {
        kind: "protein_swap",
        label: "Italian sausage instead of beef",
        description:
          "Use sweet Italian sausage instead of ground beef. Same steps, even more flavor.",
        removes: ["ground beef"],
        adds: [ing("sweet italian sausage", 1.5, "lb", "casings removed")],
        extraSteps: [
          "To remove the casings, slit each sausage lengthwise with a knife and squeeze the meat out. Cook it just like the ground beef.",
        ],
        avoids: ["ground beef"],
      },
      {
        kind: "healthy",
        label: "Zucchini noodles",
        description:
          "Swap the spaghetti for zucchini noodles for a lighter, veggie-packed bowl.",
        removes: ["spaghetti"],
        adds: [
          ing(
            "zucchini",
            5,
            "whole",
            "spiralized (or 2 packages store-bought zucchini noodles)",
          ),
        ],
        extraSteps: [
          "Skip boiling water. Cook the zucchini noodles in a separate skillet with a little olive oil for 2 to 3 minutes, just until warm. Any longer and they get mushy.",
        ],
        extraActiveMinutes: 5,
      },
    ],
    pairsWith: ["simple-green-salad", "roasted-vegetables"],
  },
  {
    slug: "sausage-and-peppers",
    title: "Sheet Pan Sausage and Peppers",
    description:
      "Sausage, peppers, and onions roasted together on one pan. The oven does the work and you get one pan to wash.",
    kind: "main",
    cuisine: "Italian",
    tags: ["italian", "high_protein", "kid_favorite"],
    method: "sheet_pan",
    activeMinutes: 15,
    totalMinutes: 45,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Swap 2 of the sweet links for hot Italian sausage and keep them at one end of the pan for dad.",
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("sweet italian sausage", 2, "lb", "about 10 links"),
      ing(
        "hot italian sausage",
        2,
        "whole",
        "links for dad, in place of 2 sweet links",
        true,
      ),
      ing("bell pepper", 3, "whole", "mixed colors, sliced into strips"),
      ing("yellow onion", 2, "whole", "cut into wedges"),
      ing("olive oil", 2, "tbsp"),
      ing("italian seasoning", 2, "tsp"),
      ing("hoagie roll", 5, "whole", "for serving"),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the oven to 425°F. Line a large sheet pan with foil for easy cleanup.",
      },
      {
        text: "Pile the pepper strips and onion wedges on the pan. Drizzle with the olive oil, sprinkle with Italian seasoning, a big pinch of salt, and some pepper, then toss with your hands.",
      },
      {
        text: "Tuck the sausages in between the veggies. If you're using hot links for dad, put them together at one end so they don't get mixed up.",
      },
      {
        text: "Roast for 15 minutes, then flip the sausages and stir the veggies.",
        timerMinutes: 15,
      },
      {
        text: "Roast 15 more minutes, until the sausages are browned and cooked through (160°F inside, or no pink when you cut one open).",
        timerMinutes: 15,
      },
      {
        text: "Split the rolls, pop them in the oven for 2 minutes to toast, and fill with sausage and peppers.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Skip the rolls",
        description:
          "Serve the sausage and peppers over cauliflower rice instead of in rolls.",
        removes: ["hoagie roll"],
        adds: [ing("cauliflower rice", 24, "oz", "frozen, two 12-oz bags")],
        extraSteps: [
          "Microwave the cauliflower rice as the bag says while the sausages roast, then spoon the sausage and peppers over it.",
        ],
      },
    ],
    pairsWith: ["steamed-rice", "simple-green-salad"],
  },
  {
    slug: "baked-mostaccioli",
    title: "Baked Mostaccioli",
    description:
      "Tube pasta, meat sauce, and a creamy ricotta layer baked under bubbly mozzarella. Great for a weekend or made ahead for a busy night.",
    kind: "main",
    cuisine: "Italian",
    tags: ["pasta", "italian", "comfort", "make_ahead", "kid_favorite"],
    method: "oven",
    activeMinutes: 30,
    totalMinutes: 75,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: "Red pepper flakes at the table for dad.",
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "comfort",
    cooldownDays: null,
    ingredients: [
      ing("mostaccioli pasta", 1, "lb", "or penne"),
      ing("ground beef", 1, "lb"),
      ing("yellow onion", 1, "whole", "diced"),
      ing("garlic", 2, "clove", "minced"),
      ing("italian seasoning", 1, "tsp"),
      ing("marinara sauce", 2, "jar", "24 oz each"),
      ing("ricotta cheese", 15, "oz"),
      ing("shredded mozzarella", 3, "cup", "divided"),
      ing("grated parmesan", 0.5, "cup", "divided"),
      ing("red pepper flakes", null, "to_taste", "for dad, at the table", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the oven to 375°F. Boil a big pot of salted water and cook the pasta 2 minutes less than the package says (it finishes cooking in the oven). Drain.",
        timerMinutes: 8,
      },
      {
        text: "Meanwhile, cook the ground beef and onion in a large skillet over medium-high heat, breaking the meat into crumbles, until no pink is left, about 8 minutes. Spoon out extra grease.",
        timerMinutes: 8,
      },
      {
        text: "Stir the garlic and Italian seasoning into the meat for 1 minute, then pour in the marinara. Stir the drained pasta into the sauce.",
      },
      {
        text: "In a small bowl, mix the ricotta with 1 cup of the mozzarella, half the parmesan, and a pinch of salt and pepper.",
      },
      {
        text: "Spread half the pasta in a 9x13 baking dish. Drop spoonfuls of the ricotta mix over it, then cover with the rest of the pasta. Sprinkle the remaining mozzarella and parmesan on top.",
      },
      {
        text: "Make-ahead option: at this point you can cover the dish and refrigerate it for up to 2 days. Add 15 minutes to the covered baking time.",
      },
      {
        text: "Cover with foil and bake 20 minutes. Remove the foil and bake 15 more minutes, until the cheese is bubbly and golden.",
        timerMinutes: 35,
      },
      {
        text: "Let it rest 10 minutes before scooping so it holds together.",
        timerMinutes: 10,
      },
    ],
    variants: [
      {
        kind: "protein_swap",
        label: "Italian sausage instead of beef",
        description: "Use sweet Italian sausage in the sauce instead of ground beef.",
        removes: ["ground beef"],
        adds: [ing("sweet italian sausage", 1, "lb", "casings removed")],
        extraSteps: [
          "Slit the sausage casings with a knife and squeeze out the meat, then cook it just like the ground beef.",
        ],
        avoids: ["ground beef"],
      },
      {
        kind: "healthy",
        label: "Whole wheat and spinach",
        description:
          "Use whole wheat penne, stir in a bag of spinach, and go lighter on the cheese.",
        removes: ["mostaccioli pasta"],
        adds: [
          ing("whole wheat penne", 1, "lb"),
          ing("baby spinach", 5, "oz"),
        ],
        extraSteps: [
          "Stir the spinach into the hot meat sauce until it wilts before adding the pasta. Use only 2 cups of mozzarella total.",
        ],
      },
    ],
    pairsWith: ["simple-green-salad", "roasted-vegetables"],
  },
  {
    slug: "taco-night",
    title: "Taco Night",
    description:
      "Seasoned beef and a build-your-own toppings bar, so everyone makes their taco exactly how they like it. Taco architecture is encouraged.",
    kind: "main",
    cuisine: "Mexican",
    tags: ["mexican", "kid_favorite"],
    method: "stovetop",
    activeMinutes: 25,
    totalMinutes: 25,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Use mild taco seasoning for everyone. Set out hot sauce and pickled jalapeños at dad's end of the toppings bar.",
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("ground beef", 1.5, "lb"),
      ing("taco seasoning", 1, "package", "mild, about 1 oz"),
      ing("flour tortilla", 12, "whole", "6-inch (or hard taco shells)"),
      ing("shredded cheddar", 2, "cup"),
      ing("romaine lettuce", 1, "head", "thinly sliced"),
      ing("roma tomato", 2, "whole", "diced"),
      ing("sour cream", 1, "cup"),
      ing("salsa", 1, "jar", "mild, 16 oz"),
      ing("hot sauce", null, "to_taste", "for dad", true),
      ing("pickled jalapeño", null, "to_taste", "for dad", true),
    ],
    steps: [
      {
        text: "Cook the ground beef in a large skillet over medium-high heat, breaking it into crumbles with a wooden spoon, until no pink is left, about 8 minutes. Spoon out most of the grease.",
        timerMinutes: 8,
      },
      {
        text: "Stir in the taco seasoning and 2/3 cup water. Let it bubble on low until the liquid is mostly gone and the meat looks saucy, about 5 minutes.",
        timerMinutes: 5,
      },
      {
        text: "Meanwhile, set up the toppings bar: lettuce, tomato, cheese, sour cream, and salsa in bowls. Put the hot sauce and jalapeños at dad's end.",
      },
      {
        text: "Warm the tortillas: wrap them in a damp paper towel and microwave for 30 to 45 seconds, or heat each one in a dry skillet for about 20 seconds per side.",
      },
      {
        text: "Put the meat on the bar and let everyone build their own tacos.",
      },
    ],
    variants: [
      {
        kind: "protein_swap",
        label: "Shredded chicken tacos",
        description:
          "Use a store-bought rotisserie chicken instead of ground beef. Even faster.",
        removes: ["ground beef"],
        adds: [ing("rotisserie chicken", 1, "whole", "meat shredded, skin removed")],
        extraSteps: [
          "Pull the chicken meat off the bones and shred it. Warm it in the skillet with the taco seasoning and 1/2 cup water for about 3 minutes.",
        ],
        avoids: ["ground beef"],
      },
      {
        kind: "protein_swap",
        label: "Steak tacos",
        description: "Seared, thinly sliced flank steak instead of ground beef.",
        removes: ["ground beef"],
        adds: [ing("flank steak", 1.5, "lb")],
        extraSteps: [
          "Rub the steak with the taco seasoning and a little oil. Cook in a very hot skillet (or on the grill) 4 to 5 minutes per side, then let it rest 5 minutes.",
          "Slice it thin across the grain, meaning cut across the lines you can see running through the meat. That keeps it tender.",
        ],
        extraActiveMinutes: 5,
        avoids: ["ground beef"],
      },
      {
        kind: "healthy",
        label: "Burrito bowls on greens",
        description:
          "Skip the tortillas and build bowls on a bed of lettuce with beans, corn, and avocado.",
        removes: ["flour tortilla"],
        adds: [
          ing("black beans", 1, "can", "15 oz, drained and rinsed"),
          ing("frozen corn", 1.5, "cup"),
          ing("avocado", 2, "whole", "diced"),
          ing("romaine lettuce", 1, "head", "extra, chopped for the bowl base"),
        ],
        extraSteps: [
          "Warm the beans and corn together in a small pot or the microwave. Build bowls: lettuce first, then meat, beans, corn, avocado, and toppings.",
        ],
        extraActiveMinutes: 5,
      },
    ],
    pairsWith: ["steamed-rice"],
  },
  {
    slug: "chicken-quesadillas",
    title: "Chicken Quesadillas",
    description:
      "Crispy, cheesy quesadillas made with a store-bought rotisserie chicken. Dinner in 20 minutes, and nobody argues about who got the bigger wedge. (They will.)",
    kind: "main",
    cuisine: "Mexican",
    tags: ["mexican", "kid_favorite"],
    method: "stovetop",
    activeMinutes: 20,
    totalMinutes: 20,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Add pickled jalapeños inside dad's quesadilla before folding, and put hot sauce on the table.",
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("rotisserie chicken", 1, "whole", "meat shredded, about 4 cups"),
      ing("flour tortilla", 8, "whole", "10-inch"),
      ing("shredded mexican cheese blend", 3, "cup"),
      ing("butter", 2, "tbsp"),
      ing("sour cream", 1, "cup", "for serving"),
      ing("salsa", 1, "jar", "mild, 16 oz, for serving"),
      ing("pickled jalapeño", null, "to_taste", "for dad", true),
      ing("hot sauce", null, "to_taste", "for dad", true),
    ],
    steps: [
      {
        text: "Pull the chicken meat off the bones and shred it into small pieces with your fingers or two forks. Skip the skin.",
      },
      {
        text: "Lay a tortilla flat. Sprinkle cheese on one half, add a handful of chicken, then a little more cheese (the cheese on top glues it together). Fold the empty half over. Repeat with the rest. Add jalapeños to dad's.",
      },
      {
        text: "Melt about 1 teaspoon of butter in a large skillet over medium heat. Cook 2 quesadillas at a time for 2 to 3 minutes per side, pressing gently with a spatula, until golden and the cheese melts.",
        timerMinutes: 3,
      },
      {
        text: "Keep finished quesadillas warm on a sheet pan in a 200°F oven while you cook the rest.",
      },
      {
        text: "Cut into wedges (a pizza cutter works great) and serve with sour cream and salsa.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Whole wheat and spinach",
        description:
          "Use whole wheat tortillas, tuck in spinach, and use half the cheese.",
        removes: ["flour tortilla"],
        adds: [
          ing("whole wheat tortilla", 8, "whole", "10-inch"),
          ing("baby spinach", 3, "oz"),
        ],
        extraSteps: [
          "Layer a small handful of spinach with the chicken, and use about 1 1/2 cups cheese total.",
        ],
      },
      {
        kind: "protein_boost",
        label: "Extra protein",
        description: "Add black beans to the filling for more protein and fiber.",
        adds: [ing("black beans", 1, "can", "15 oz, drained and rinsed")],
        extraSteps: [
          "Sprinkle a spoonful of black beans on with the chicken before folding.",
        ],
      },
    ],
    pairsWith: ["steamed-rice", "simple-green-salad"],
  },
  {
    slug: "chicken-parm-sandwiches",
    title: "Chicken Parmesan Sandwiches",
    description:
      "Crispy breaded chicken, marinara, and melty mozzarella on a toasted roll. Baked (or air fried), not deep fried, so it's easy on a weeknight.",
    kind: "main",
    cuisine: "Italian",
    tags: ["italian", "comfort", "kid_favorite"],
    method: "oven",
    activeMinutes: 25,
    totalMinutes: 40,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Sprinkle red pepper flakes under the cheese on dad's cutlet, or add hot sauce to his sandwich.",
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "comfort",
    cooldownDays: null,
    ingredients: [
      ing(
        "boneless skinless chicken breast",
        1.5,
        "lb",
        "about 3 breasts, or 5 thin-sliced cutlets",
      ),
      ing("egg", 2, "whole"),
      ing("italian breadcrumbs", 1.5, "cup"),
      ing("grated parmesan", 0.5, "cup"),
      ing("olive oil", 3, "tbsp"),
      ing("marinara sauce", 1, "jar", "24 oz"),
      ing("shredded mozzarella", 1.5, "cup"),
      ing("hoagie roll", 5, "whole"),
      ing("red pepper flakes", null, "to_taste", "for dad", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the oven to 425°F. Line a sheet pan with foil and brush it with 1 tablespoon of the olive oil. (Air fryer option: heat it to 400°F.)",
      },
      {
        text: "If your chicken breasts are thick, lay each one flat and carefully slice it in half sideways, like opening a book, to make 2 thin cutlets. You need 5 cutlets. Sprinkle with salt and pepper.",
      },
      {
        text: "Set up 2 shallow bowls: beat the eggs in one, and mix the breadcrumbs and parmesan in the other. Dip each cutlet in egg, let the extra drip off, then press it into the crumbs on both sides.",
      },
      {
        text: "Lay the cutlets on the pan and drizzle with the rest of the oil. Bake 15 minutes, flipping halfway, until cooked through (165°F inside, no pink). Air fryer: cook in one layer 10 to 12 minutes, flipping halfway.",
        timerMinutes: 15,
      },
      {
        text: "Spoon 2 tablespoons of marinara on each cutlet, top with mozzarella, and bake 3 to 5 more minutes until the cheese melts.",
        timerMinutes: 4,
      },
      {
        text: "While the cheese melts, warm the rest of the marinara and toast the split rolls. Tuck a cutlet into each roll with extra sauce.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Chicken parm over zucchini noodles",
        description:
          "Skip the rolls and serve the cutlets over warm zucchini noodles with sauce.",
        removes: ["hoagie roll"],
        adds: [
          ing(
            "zucchini",
            4,
            "whole",
            "spiralized (or 2 packages store-bought zucchini noodles)",
          ),
        ],
        extraSteps: [
          "Cook the zucchini noodles in a skillet with a little olive oil for 2 to 3 minutes, just until warm, then top with a cutlet and marinara.",
        ],
        extraActiveMinutes: 5,
      },
    ],
    pairsWith: ["simple-green-salad", "roasted-vegetables"],
  },
  {
    slug: "slow-cooker-chili",
    title: "Slow Cooker Chili",
    description:
      "Toss it in the slow cooker in the morning and come home to a house that smells amazing. Mild for the family, with a smoky chipotle topping for dad.",
    kind: "main",
    cuisine: "American",
    tags: ["american", "comfort", "one_pot", "make_ahead", "high_protein"],
    method: "slow_cooker",
    activeMinutes: 20,
    totalMinutes: 380,
    baseServings: 5,
    spiceLevel: 1,
    spiceSplit:
      "Make a chipotle topping for dad: chop 1 or 2 chipotle peppers from the can with a spoonful of their sauce and stir it into his bowl. Hot sauce on the table too.",
    seasonFit: "cold",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("ground beef", 1.5, "lb"),
      ing("yellow onion", 1, "whole", "diced"),
      ing("bell pepper", 1, "whole", "diced"),
      ing("garlic", 3, "clove", "minced"),
      ing("kidney beans", 1, "can", "15 oz, drained and rinsed"),
      ing("black beans", 1, "can", "15 oz, drained and rinsed"),
      ing("diced tomatoes", 1, "can", "28 oz"),
      ing("tomato sauce", 1, "can", "15 oz"),
      ing("chili powder", 1, "tbsp", "regular mild blend"),
      ing("ground cumin", 2, "tsp"),
      ing("smoked paprika", 1, "tsp"),
      ing("shredded cheddar", 1, "cup", "for topping"),
      ing("sour cream", 1, "cup", "for topping"),
      ing("green onion", 3, "whole", "sliced, for topping", true),
      ing("chipotle pepper in adobo", 1, "can", "7 oz, for dad's topping", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Cook the ground beef and onion in a large skillet over medium-high heat, breaking the meat into crumbles, until no pink is left, about 8 minutes. Spoon out extra grease. (Using a Dutch oven instead? Do this right in the Dutch oven.)",
        timerMinutes: 8,
      },
      {
        text: "Scrape the meat into the slow cooker. Add the bell pepper, garlic, both cans of beans, diced tomatoes with their juice, tomato sauce, chili powder, cumin, smoked paprika, and 1 teaspoon salt. Stir.",
      },
      {
        text: "Cover and cook on LOW for 6 to 8 hours (or HIGH for 3 to 4 hours). Try not to lift the lid; every peek lets heat escape.",
        timerMinutes: 360,
      },
      {
        text: "Dutch oven option: instead of the slow cooker, bring everything to a bubble on the stove, then cover and cook on low for 1 hour, stirring every 15 minutes so the bottom doesn't stick.",
      },
      {
        text: "Taste and add more salt if it needs it. For dad, chop 1 or 2 chipotle peppers from the can with a spoonful of their sauce and put it in a little bowl.",
      },
      {
        text: "Serve with cheddar, sour cream, and green onions on top.",
      },
    ],
    variants: [
      {
        kind: "protein_swap",
        label: "Shredded chicken chili",
        description:
          "Use chicken breasts instead of ground beef. They cook right in the chili and shred at the end.",
        removes: ["ground beef"],
        adds: [ing("boneless skinless chicken breast", 1.5, "lb")],
        extraSteps: [
          "Skip browning the beef. Cook the onion in a little oil for 5 minutes, then put the whole raw chicken breasts in the slow cooker with everything else.",
          "About 30 minutes before serving, lift out the chicken, shred it with two forks, and stir it back in.",
        ],
        avoids: ["ground beef"],
      },
      {
        kind: "healthy",
        label: "Extra-veggie chili",
        description:
          "Add zucchini for more veggies and top with Greek yogurt instead of sour cream.",
        removes: ["sour cream"],
        adds: [
          ing("zucchini", 1, "whole", "diced"),
          ing("plain greek yogurt", 1, "cup", "for topping"),
        ],
        extraSteps: ["Add the diced zucchini to the slow cooker with the other veggies."],
        extraActiveMinutes: 3,
      },
    ],
    pairsWith: ["simple-green-salad", "baked-potatoes"],
  },
  {
    slug: "slow-cooker-pot-roast",
    title: "Slow Cooker Pot Roast",
    description:
      "Fall-apart beef with potatoes and carrots cooked right in the pot. Twenty minutes in the morning, Sunday-dinner vibes by evening.",
    kind: "main",
    cuisine: "American",
    tags: ["american", "comfort", "one_pot", "high_protein", "kid_favorite"],
    method: "slow_cooker",
    activeMinutes: 20,
    totalMinutes: 500,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: "Serve prepared horseradish or hot sauce on the side for dad.",
    seasonFit: "cold",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("beef chuck roast", 3, "lb"),
      ing("yukon gold potato", 2, "lb", "halved (or baby potatoes, whole)"),
      ing("carrot", 5, "whole", "peeled, cut into 2-inch chunks"),
      ing("yellow onion", 1, "whole", "cut into wedges"),
      ing("garlic", 4, "clove", "smashed"),
      ing("beef broth", 1, "cup"),
      ing("dry onion soup mix", 1, "package", "about 1 oz"),
      ing("worcestershire sauce", 1, "tbsp"),
      ing("olive oil", 1, "tbsp", "for optional searing", true),
      ing("prepared horseradish", null, "to_taste", "for dad", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Put the potatoes, carrots, and onion wedges in the bottom of the slow cooker.",
      },
      {
        text: "Pat the roast dry with paper towels and season all over with salt and pepper.",
      },
      {
        text: "Optional, for deeper flavor: heat the oil in a skillet over high heat and brown the roast 3 to 4 minutes per side until it has a dark crust.",
      },
      {
        text: "Set the roast on top of the veggies. Stir together the broth, onion soup mix, Worcestershire, and garlic, and pour it over the roast.",
      },
      {
        text: "Cover and cook on LOW for 8 hours, until the meat falls apart when you poke it with a fork. Don't lift the lid; each peek adds cooking time.",
        timerMinutes: 480,
      },
      {
        text: "Move the roast to a cutting board and pull it apart into chunks with two forks. Serve with the veggies and spoon the juices over everything.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Cauliflower instead of potatoes",
        description: "Swap the potatoes for cauliflower to cut the carbs.",
        removes: ["yukon gold potato"],
        adds: [ing("cauliflower", 1, "head", "cut into large florets")],
        extraSteps: [
          "Add the cauliflower florets only for the last 2 hours of cooking so they don't turn to mush.",
        ],
      },
    ],
    pairsWith: ["simple-green-salad"],
  },
  {
    slug: "chicken-noodle-soup",
    title: "Chicken Noodle Soup",
    description:
      "Classic chicken noodle soup in about half an hour, thanks to a rotisserie chicken shortcut. Cures sniffles, grumpiness, and cold Tuesdays.",
    kind: "main",
    cuisine: "American",
    tags: ["soup", "healthy", "one_pot", "kid_favorite", "american"],
    method: "dutch_oven",
    activeMinutes: 20,
    totalMinutes: 35,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: "Dad can add hot sauce or red pepper flakes to his own bowl.",
    seasonFit: "cold",
    indoorMethod: null,
    healthCategory: "healthy",
    cooldownDays: null,
    ingredients: [
      ing("rotisserie chicken", 1, "whole", "meat shredded"),
      ing("chicken broth", 8, "cup", "low-sodium"),
      ing("egg noodles", 8, "oz"),
      ing("carrot", 3, "whole", "peeled and sliced into coins"),
      ing("celery", 3, "stalk", "sliced"),
      ing("yellow onion", 1, "whole", "diced"),
      ing("garlic", 2, "clove", "minced"),
      ing("butter", 2, "tbsp"),
      ing("dried thyme", 1, "tsp"),
      ing("bay leaf", 1, "whole"),
      ing("fresh parsley", 2, "tbsp", "chopped", true),
      ing("hot sauce", null, "to_taste", "for dad", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Melt the butter in a Dutch oven over medium heat. Add the onion, carrot, and celery and cook, stirring now and then, until soft, about 6 minutes.",
        timerMinutes: 6,
      },
      {
        text: "Stir in the garlic and thyme and cook 1 minute, until it smells great.",
      },
      {
        text: "Pour in the broth, add the bay leaf, and turn the heat to high until it boils (big bubbles).",
      },
      {
        text: "Add the egg noodles and cook uncovered at a steady bubble until tender, about 7 minutes.",
        timerMinutes: 7,
      },
      {
        text: "While the noodles cook, pull the chicken meat off the bones and shred it into bite-size pieces. Skip the skin.",
      },
      {
        text: "Stir the chicken into the soup and heat 2 minutes. Fish out the bay leaf, taste, and add salt and pepper. Top with parsley.",
      },
    ],
    variants: [
      {
        kind: "protein_boost",
        label: "Extra chicken",
        description: "Poach extra chicken breast in the broth for a high-protein bowl.",
        adds: [ing("boneless skinless chicken breast", 1, "lb")],
        extraSteps: [
          "Add the raw chicken breasts when the broth first boils. Simmer 15 minutes until cooked through, then lift them out, shred with two forks, and add the noodles. Stir the chicken back in at the end.",
        ],
        extraActiveMinutes: 3,
      },
      {
        kind: "healthy",
        label: "Veggie-loaded, lower-carb",
        description: "Swap the noodles for zucchini and spinach.",
        removes: ["egg noodles"],
        adds: [
          ing("zucchini", 2, "whole", "diced or spiralized"),
          ing("baby spinach", 3, "oz"),
        ],
        extraSteps: [
          "Add the zucchini instead of the noodles and cook 4 minutes. Stir in the spinach with the chicken.",
        ],
      },
    ],
    pairsWith: ["simple-green-salad"],
  },
  {
    slug: "grilled-cheese-tomato-soup",
    title: "Grilled Cheese and Tomato Soup",
    description:
      "Creamy tomato soup that the Vitamix heats all by itself, plus golden grilled cheese for dunking. Triangles are mandatory.",
    kind: "main",
    cuisine: "American",
    tags: ["soup", "comfort", "vegetarian", "kid_favorite", "american"],
    method: "vitamix",
    activeMinutes: 20,
    totalMinutes: 20,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Stir red pepper flakes or hot sauce into dad's bowl, and use pepper jack in his sandwich.",
    seasonFit: "cold",
    indoorMethod: null,
    healthCategory: "comfort",
    cooldownDays: null,
    ingredients: [
      ing("whole peeled tomatoes", 42, "oz", "one 28-oz can plus one 14.5-oz can, with juice"),
      ing("vegetable broth", 1, "cup"),
      ing("heavy cream", 0.5, "cup"),
      ing("garlic", 1, "clove", "peeled"),
      ing("sugar", 1, "tsp"),
      ing("fresh basil", 6, "whole", "leaves", true),
      ing("sandwich bread", 10, "slice"),
      ing("sliced cheddar", 10, "slice"),
      ing("butter", 4, "tbsp", "softened"),
      ing("sliced pepper jack", 2, "slice", "for dad's sandwich", true),
      ing("red pepper flakes", null, "to_taste", "for dad", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Put the tomatoes with their juice, broth, cream, garlic, sugar, 1 teaspoon salt, and a few grinds of pepper in the Vitamix. Lock the lid on with the lid plug in place.",
      },
      {
        text: "Start on the lowest speed, then quickly turn it up to the highest speed. Blend about 6 minutes, until steam puffs out of the lid. The fast-spinning blades heat the soup by friction, so no stove is needed.",
        timerMinutes: 6,
      },
      {
        text: "While it blends, butter one side of each bread slice. Make sandwiches with 2 slices of cheese inside and the buttered sides facing out. Use pepper jack in dad's.",
      },
      {
        text: "Heat a large skillet or griddle over medium-low heat. Cook the sandwiches 3 to 4 minutes per side until golden and melty. Keep the heat low so the bread doesn't burn before the cheese melts.",
        timerMinutes: 4,
      },
      {
        text: "Taste the soup and add salt if needed. Pour into bowls, tear a little basil on top, and serve with the sandwiches cut into triangles.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Whole grain with spinach",
        description:
          "Use whole wheat bread and tuck a few spinach leaves into each sandwich.",
        removes: ["sandwich bread"],
        adds: [
          ing("whole wheat bread", 10, "slice"),
          ing("baby spinach", 2, "oz"),
        ],
        extraSteps: ["Add a small handful of spinach between the cheese slices."],
      },
      {
        kind: "protein_boost",
        label: "Ham and cheese",
        description: "Add deli ham to the sandwiches for more protein.",
        adds: [ing("sliced deli ham", 8, "oz")],
        extraSteps: ["Layer a couple slices of ham between the cheese in each sandwich."],
      },
    ],
    pairsWith: ["simple-green-salad"],
  },
  {
    slug: "ham-scalloped-potatoes",
    title: "Ham and Scalloped Potatoes",
    description:
      "Thin potatoes baked in a cheesy sauce with chunks of ham. A weekend bake; for a weeknight shortcut, layer it all in a greased slow cooker in the morning and cook on LOW 7 to 8 hours.",
    kind: "main",
    cuisine: "American",
    tags: ["comfort", "american", "kid_favorite", "make_ahead"],
    method: "oven",
    activeMinutes: 30,
    totalMinutes: 105,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Sprinkle cayenne over one corner of the dish before baking for dad, or pass hot sauce at the table.",
    seasonFit: "cold",
    indoorMethod: null,
    healthCategory: "comfort",
    cooldownDays: null,
    ingredients: [
      ing(
        "ham steak",
        1.5,
        "lb",
        "fully cooked, cubed (or leftover spiral ham slices)",
      ),
      ing("russet potato", 3, "lb", "peeled and thinly sliced"),
      ing("yellow onion", 0.5, "whole", "thinly sliced"),
      ing("garlic", 2, "clove", "minced"),
      ing("butter", 3, "tbsp", "plus more for the dish"),
      ing("all-purpose flour", 3, "tbsp"),
      ing("whole milk", 3, "cup"),
      ing("shredded cheddar", 1.5, "cup", "divided"),
      ing("cayenne pepper", null, "to_taste", "for dad's corner", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the oven to 375°F. Rub butter all over the inside of a 9x13 baking dish.",
      },
      {
        text: "Slice the potatoes very thin, about as thick as a coin (a mandoline slicer makes this quick). Cut the ham into bite-size cubes.",
      },
      {
        text: "Make the cheese sauce: melt the butter in a saucepan over medium heat. Whisk in the flour and stir for 1 minute; this paste is what thickens the sauce. Slowly pour in the milk while whisking so no lumps form.",
      },
      {
        text: "Add the garlic, 1 1/2 teaspoons salt, and some pepper. Keep stirring until the sauce is thick enough to coat a spoon, about 5 minutes. Take it off the heat and stir in 1 cup of the cheddar.",
        timerMinutes: 5,
      },
      {
        text: "Layer half the potatoes, half the onion, and half the ham in the dish, then pour on half the sauce. Repeat with the rest.",
      },
      {
        text: "Cover with foil and bake 45 minutes. Remove the foil, sprinkle on the remaining cheddar, and bake 25 to 30 minutes more, until a knife slides easily into the potatoes and the top is golden.",
        timerMinutes: 75,
      },
      {
        text: "Let it rest 10 minutes so the sauce thickens up before serving.",
        timerMinutes: 10,
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Half cauliflower, lighter milk",
        description:
          "Swap half the potatoes for cauliflower and use 2% milk for a lighter bake.",
        removes: ["russet potato", "whole milk"],
        adds: [
          ing("russet potato", 1.5, "lb", "peeled and thinly sliced"),
          ing("cauliflower", 1, "head", "cut into small, thin florets"),
          ing("2% milk", 3, "cup"),
        ],
        extraSteps: ["Layer the cauliflower in with the potatoes."],
      },
    ],
    pairsWith: ["simple-green-salad", "roasted-vegetables"],
  },
  {
    slug: "grilled-steak",
    title: "Grilled Steak",
    description:
      "Simple, juicy grilled steak with just salt, pepper, and garlic. Dad's time to shine at the grill.",
    kind: "main",
    cuisine: "American",
    tags: ["grilled", "high_protein", "american"],
    method: "grill",
    activeMinutes: 20,
    totalMinutes: 30,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: "Rub dad's steak with chipotle chili powder before grilling.",
    seasonFit: "warm",
    indoorMethod: "cast-iron skillet",
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("sirloin steak", 2.5, "lb", "about 1 inch thick"),
      ing("olive oil", 1, "tbsp"),
      ing("garlic powder", 1, "tsp"),
      ing("butter", 2, "tbsp", "for topping", true),
      ing("chipotle chili powder", 1, "tsp", "for dad's steak", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "If you have time, take the steaks out of the fridge 20 to 30 minutes early so they cook more evenly. Pat dry with paper towels, rub with oil, and season well with salt, pepper, and garlic powder. Rub chipotle powder on dad's.",
      },
      {
        text: "Heat the grill to high with the lid closed for 10 to 15 minutes, then scrape the grates clean with a grill brush.",
      },
      {
        text: "Grill the steaks 4 to 5 minutes per side with the lid closed, flipping once. Check with an instant-read thermometer in the thickest part: 130°F for medium-rare, 140°F for medium, 150°F for medium-well.",
        timerMinutes: 5,
      },
      {
        text: "Move the steaks to a cutting board, top with a pat of butter, and let them rest 5 minutes so the juices settle instead of running out.",
        timerMinutes: 5,
      },
      {
        text: "Slice across the grain, meaning cut across the lines you can see running through the meat. Short fibers make every bite tender.",
      },
      {
        text: "Indoor option: heat a cast-iron skillet over high heat until very hot, add a little oil, and cook 3 to 4 minutes per side. Turn on the vent fan; it gets smoky.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Steak salad",
        description:
          "Serve the sliced steak over a big salad instead of with potatoes.",
        removes: ["butter"],
        adds: [
          ing("mixed salad greens", 10, "oz"),
          ing("cherry tomato", 2, "cup", "halved"),
          ing("cucumber", 1, "whole", "sliced"),
          ing("italian dressing", 0.5, "cup"),
        ],
        extraSteps: [
          "Toss the greens, tomatoes, and cucumber with the dressing and lay the sliced steak on top.",
        ],
        extraActiveMinutes: 5,
      },
    ],
    pairsWith: [
      "mashed-potatoes",
      "baked-potatoes",
      "grilled-vegetables",
      "simple-green-salad",
    ],
  },
  {
    slug: "grilled-chicken",
    title: "Lemon Garlic Grilled Chicken",
    description:
      "Tender chicken in a bright lemon-garlic marinade, with a separate fiery bag just for dad. Label the bags. Trust us.",
    kind: "main",
    cuisine: "American",
    tags: ["grilled", "healthy", "high_protein", "american"],
    method: "grill",
    activeMinutes: 20,
    totalMinutes: 60,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Split the marinade into two bags. Add hot sauce and cayenne to the small bag for dad's 1 or 2 breasts, and grill them on their own side of the grill.",
    seasonFit: "any",
    indoorMethod: "broiler",
    healthCategory: "healthy",
    cooldownDays: null,
    ingredients: [
      ing("boneless skinless chicken breast", 2.5, "lb", "about 5 small breasts"),
      ing("olive oil", 0.33, "cup"),
      ing("lemon", 1, "whole", "zested and juiced"),
      ing("garlic", 3, "clove", "minced"),
      ing("dried oregano", 1, "tsp"),
      ing("honey", 1, "tbsp"),
      ing("hot sauce", 2, "tbsp", "for dad's bag", true),
      ing("cayenne pepper", 0.5, "tsp", "for dad's bag", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Flatten the chicken so it cooks evenly: lay each breast between two sheets of plastic wrap and pound the thick end with the bottom of a heavy pan until it's about 3/4 inch thick all over.",
      },
      {
        text: "Whisk the olive oil, lemon zest and juice, garlic, oregano, honey, 1 teaspoon salt, and some pepper. Put most of the chicken in a big zip-top bag and dad's 1 or 2 pieces in a small bag.",
      },
      {
        text: "Pour most of the marinade into the big bag and the rest into the small bag. Add the hot sauce and cayenne to the small bag and write HOT on it.",
      },
      {
        text: "Refrigerate for at least 30 minutes (up to 8 hours).",
        timerMinutes: 30,
      },
      {
        text: "Heat the grill to medium-high for 10 minutes and scrape the grates clean. Grill the chicken 5 to 7 minutes per side, keeping dad's on its own side, until it reaches 165°F inside (no pink in the middle).",
        timerMinutes: 12,
      },
      {
        text: "Let the chicken rest 5 minutes on a cutting board, then slice.",
        timerMinutes: 5,
      },
      {
        text: "Indoor option: set the oven rack about 6 inches under the broiler and turn the broiler to high. Broil on a foil-lined sheet pan 6 to 8 minutes per side until 165°F inside.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Grilled chicken salad",
        description: "Slice the chicken over a big crunchy salad.",
        adds: [
          ing("mixed salad greens", 10, "oz"),
          ing("cherry tomato", 2, "cup", "halved"),
          ing("cucumber", 1, "whole", "sliced"),
        ],
        extraSteps: [
          "Toss the greens, tomatoes, and cucumber with a squeeze of lemon and a drizzle of olive oil, then top with sliced chicken.",
        ],
        extraActiveMinutes: 5,
      },
    ],
    pairsWith: [
      "grilled-vegetables",
      "steamed-rice",
      "baked-potatoes",
      "simple-green-salad",
    ],
  },
  {
    slug: "grilled-skewers",
    title: "Chicken or Steak Skewers",
    description:
      "Chunks of marinated chicken (or steak) and veggies grilled on sticks. Food on a stick is scientifically more fun.",
    kind: "main",
    cuisine: "American",
    tags: ["grilled", "healthy", "high_protein", "kid_favorite", "american"],
    method: "grill",
    activeMinutes: 30,
    totalMinutes: 50,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Make 2 all-meat skewers for dad and brush them with hot sauce (or sprinkle cayenne) before grilling.",
    seasonFit: "warm",
    indoorMethod: "broiler",
    healthCategory: "healthy",
    cooldownDays: null,
    ingredients: [
      ing("boneless skinless chicken breast", 2, "lb", "cut into 1 1/2-inch cubes"),
      ing("bell pepper", 2, "whole", "cut into 1 1/2-inch pieces"),
      ing("red onion", 1, "whole", "cut into chunks"),
      ing("zucchini", 1, "whole", "cut into thick half-moons"),
      ing("italian dressing", 0.75, "cup", "used as the marinade"),
      ing("wooden skewer", 10, "whole", "or metal skewers"),
      ing("hot sauce", 2, "tbsp", "for dad's skewers", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "If using wooden skewers, soak them in water for 20 minutes so they don't burn on the grill.",
        timerMinutes: 20,
      },
      {
        text: "While they soak, toss the chicken with half the Italian dressing in one bowl and the veggies with the other half in another bowl. Sprinkle both with salt and pepper.",
      },
      {
        text: "Thread the chicken and veggies onto the skewers, switching back and forth. Make 2 all-chicken skewers for dad and brush them with hot sauce.",
      },
      {
        text: "Heat the grill to medium-high and scrape the grates clean. Grill the skewers 10 to 12 minutes, turning every 3 minutes, until the chicken is 165°F inside (no pink when you cut a piece open).",
        timerMinutes: 12,
      },
      {
        text: "Indoor option: broil on a foil-lined sheet pan about 4 inches under the broiler for 10 to 12 minutes, turning halfway.",
      },
    ],
    variants: [
      {
        kind: "protein_swap",
        label: "Steak skewers",
        description: "Use sirloin steak cubes instead of chicken.",
        removes: ["boneless skinless chicken breast"],
        adds: [ing("sirloin steak", 2, "lb", "cut into 1 1/2-inch cubes")],
        extraSteps: [
          "Grill steak skewers 8 to 10 minutes, turning every few minutes, for medium (140°F inside).",
        ],
        avoids: ["chicken"],
      },
      {
        kind: "healthy",
        label: "Over cauliflower rice",
        description: "Serve the skewers over cauliflower rice instead of white rice.",
        adds: [ing("cauliflower rice", 24, "oz", "frozen, two 12-oz bags")],
        extraSteps: ["Microwave the cauliflower rice as the bag says while the skewers grill."],
      },
    ],
    pairsWith: ["steamed-rice", "simple-green-salad"],
  },
  {
    slug: "bbq-pork-chops",
    title: "BBQ Pork Chops",
    description:
      "Juicy pork chops with a sweet smoky rub, brushed with BBQ sauce at the end. Napkins required.",
    kind: "main",
    cuisine: "American",
    tags: ["grilled", "high_protein", "kid_favorite", "american"],
    method: "grill",
    activeMinutes: 20,
    totalMinutes: 35,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Mix cayenne into a spoonful of the rub for dad's chop, and pass hot sauce for extra heat.",
    seasonFit: "any",
    indoorMethod: "oven",
    healthCategory: "balanced",
    cooldownDays: null,
    ingredients: [
      ing("bone-in pork chop", 5, "whole", "about 1 inch thick"),
      ing("olive oil", 1, "tbsp"),
      ing("brown sugar", 1, "tbsp"),
      ing("smoked paprika", 1, "tsp"),
      ing("garlic powder", 1, "tsp"),
      ing("bbq sauce", 1, "cup"),
      ing("cayenne pepper", 0.25, "tsp", "for dad's chop", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Mix the brown sugar, smoked paprika, garlic powder, 1 teaspoon salt, and 1/2 teaspoon pepper in a small bowl. This is your rub. For dad, stir the cayenne into a spoonful of it.",
      },
      {
        text: "Pat the chops dry, rub them with the oil, then press the rub onto both sides.",
      },
      {
        text: "Heat the grill to medium-high and scrape the grates clean. Grill the chops 5 to 6 minutes per side.",
        timerMinutes: 12,
      },
      {
        text: "In the last 2 to 3 minutes, brush BBQ sauce on both sides. (Add it earlier and the sugar burns.) They're done at 145°F inside.",
      },
      {
        text: "Let the chops rest 5 minutes before cutting so they stay juicy.",
        timerMinutes: 5,
      },
      {
        text: "Indoor option: bake on a foil-lined sheet pan at 400°F for 18 to 22 minutes, brushing on the sauce for the last 5 minutes.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Lighter sauce",
        description: "Skip the brown sugar and use a sugar-free BBQ sauce.",
        removes: ["bbq sauce", "brown sugar"],
        adds: [ing("sugar-free bbq sauce", 1, "cup")],
      },
    ],
    pairsWith: [
      "baked-potatoes",
      "mashed-potatoes",
      "grilled-vegetables",
      "simple-green-salad",
    ],
  },
  {
    slug: "chicken-souvlaki",
    title: "Chicken Souvlaki",
    description:
      "Lemony Greek chicken skewers stuffed into warm pitas with cool tzatziki. Opa!",
    kind: "main",
    cuisine: "Greek",
    tags: ["greek", "grilled", "healthy", "high_protein"],
    method: "grill",
    activeMinutes: 25,
    totalMinutes: 60,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit:
      "Sprinkle red pepper flakes on dad's skewers before grilling, or stir hot sauce into his tzatziki.",
    seasonFit: "any",
    indoorMethod: "sheet pan in the oven at 425°F",
    healthCategory: "healthy",
    cooldownDays: null,
    ingredients: [
      ing("boneless skinless chicken breast", 2, "lb", "cut into 1-inch cubes"),
      ing("olive oil", 0.25, "cup"),
      ing("lemon", 1, "whole", "juiced"),
      ing("garlic", 3, "clove", "minced"),
      ing("dried oregano", 2, "tsp"),
      ing("pita bread", 5, "whole"),
      ing("tzatziki", 16, "oz", "store-bought"),
      ing("roma tomato", 2, "whole", "diced"),
      ing("cucumber", 1, "whole", "diced"),
      ing("red onion", 0.5, "whole", "thinly sliced"),
      ing("wooden skewer", 10, "whole", "or metal skewers"),
      ing("red pepper flakes", null, "to_taste", "for dad", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "In a bowl, mix the olive oil, lemon juice, garlic, oregano, 1 teaspoon salt, and some pepper. Add the chicken and stir to coat. Cover and refrigerate 30 minutes. Soak wooden skewers in water at the same time.",
        timerMinutes: 30,
      },
      {
        text: "While the chicken marinates, dice the tomatoes and cucumber and thinly slice the red onion.",
      },
      {
        text: "Thread the chicken onto the skewers. Sprinkle red pepper flakes on dad's.",
      },
      {
        text: "Heat the grill to medium-high and scrape the grates clean. Grill 10 to 12 minutes, turning every few minutes, until the chicken is 165°F inside (no pink).",
        timerMinutes: 12,
      },
      {
        text: "Indoor option: skip the skewers, spread the chicken on a foil-lined sheet pan, and roast at 425°F for 15 to 18 minutes.",
      },
      {
        text: "Warm the pitas on the grill (or in a dry skillet) for about 30 seconds per side.",
      },
      {
        text: "Build: pita, chicken, a big spoonful of tzatziki, then tomato, cucumber, and onion. Fold and eat.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Greek salad instead of pita",
        description:
          "Skip the pita and serve the chicken on a Greek salad with feta and olives.",
        removes: ["pita bread"],
        adds: [
          ing("romaine lettuce", 1, "head", "chopped"),
          ing("feta cheese", 4, "oz", "crumbled"),
          ing("kalamata olive", 0.5, "cup", "pitted"),
          ing("red wine vinaigrette", 0.5, "cup"),
        ],
        extraSteps: [
          "Toss the romaine, tomato, cucumber, onion, feta, and olives with the vinaigrette. Top with the chicken and a spoonful of tzatziki.",
        ],
        extraActiveMinutes: 5,
      },
    ],
    pairsWith: ["steamed-rice", "grilled-vegetables", "simple-green-salad"],
  },
  {
    slug: "avgolemono-soup",
    title: "Avgolemono Soup",
    description:
      "Greek lemon chicken and rice soup, silky and bright from eggs and lemon. Sounds fancy, tastes like a hug.",
    kind: "main",
    cuisine: "Greek",
    tags: ["greek", "soup", "healthy", "one_pot"],
    method: "dutch_oven",
    activeMinutes: 25,
    totalMinutes: 35,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: "Dad can add red pepper flakes or hot sauce to his own bowl.",
    seasonFit: "cold",
    indoorMethod: null,
    healthCategory: "healthy",
    cooldownDays: null,
    ingredients: [
      ing("chicken broth", 8, "cup", "low-sodium"),
      ing("long-grain white rice", 0.75, "cup"),
      ing("rotisserie chicken", 1, "whole", "meat shredded"),
      ing("egg", 3, "whole"),
      ing("lemon", 3, "whole", "juiced, about 1/2 cup"),
      ing("yellow onion", 1, "whole", "finely diced"),
      ing("carrot", 2, "whole", "finely diced"),
      ing("olive oil", 1, "tbsp"),
      ing("fresh dill", 2, "tbsp", "chopped (or fresh parsley)", true),
      ing("red pepper flakes", null, "to_taste", "for dad", true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the olive oil in a Dutch oven over medium heat. Add the onion and carrot and cook until soft, about 5 minutes.",
        timerMinutes: 5,
      },
      {
        text: "Add the broth and bring to a boil. Stir in the rice, turn the heat down so it bubbles gently, cover, and cook until the rice is tender, about 15 minutes.",
        timerMinutes: 15,
      },
      {
        text: "Meanwhile, shred the chicken meat. In a medium bowl, whisk the eggs until frothy, then whisk in the lemon juice.",
      },
      {
        text: "Warm up the eggs so they don't scramble (this is called tempering): while whisking the egg mix nonstop, slowly pour in one ladle of the hot broth. Repeat with 2 more ladles.",
      },
      {
        text: "Turn the heat to low. Pour the warm egg mix into the pot while stirring, then add the chicken. Stir gently 3 to 5 minutes until the soup thickens slightly. Don't let it boil or the eggs will curdle.",
        timerMinutes: 4,
      },
      {
        text: "Taste and add salt and pepper. Top with dill.",
      },
    ],
    variants: [
      {
        kind: "protein_boost",
        label: "Extra chicken",
        description: "Poach extra chicken breast in the broth for more protein.",
        adds: [ing("boneless skinless chicken breast", 1, "lb")],
        extraSteps: [
          "Add the raw chicken breasts to the broth with the rice. After 15 minutes, lift them out, shred with two forks, and stir back in with the rotisserie chicken.",
        ],
        extraActiveMinutes: 3,
      },
      {
        kind: "healthy",
        label: "Cauliflower rice and spinach",
        description: "Swap the white rice for cauliflower rice and add spinach.",
        removes: ["long-grain white rice"],
        adds: [
          ing("cauliflower rice", 12, "oz", "frozen"),
          ing("baby spinach", 3, "oz"),
        ],
        extraSteps: [
          "Add the cauliflower rice instead of the rice and simmer only 5 minutes. Stir in the spinach with the chicken.",
        ],
      },
    ],
    pairsWith: ["simple-green-salad"],
  },

  // ───────────────────────────── Sides ─────────────────────────────
  {
    slug: "mashed-potatoes",
    title: "Mashed Potatoes",
    description: "Creamy, buttery mashed potatoes. The ultimate gravy boat.",
    kind: "side",
    cuisine: "American",
    tags: ["comfort", "vegetarian", "kid_favorite", "american"],
    method: "stovetop",
    activeMinutes: 15,
    totalMinutes: 35,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: null,
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "comfort",
    cooldownDays: 1,
    ingredients: [
      ing("yukon gold potato", 3, "lb", "peeled and cut into 2-inch chunks"),
      ing("butter", 4, "tbsp"),
      ing("whole milk", 0.75, "cup", "warmed"),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Put the potatoes in a large pot, cover with cold water by 1 inch, and add 1 tablespoon salt. Bring to a boil over high heat.",
      },
      {
        text: "Lower the heat to a steady bubble and cook until a fork slides easily into a chunk, about 15 minutes.",
        timerMinutes: 15,
      },
      {
        text: "Drain well and put the potatoes back in the warm pot. Add the butter and warm milk.",
      },
      {
        text: "Mash with a potato masher until smooth. Season with salt and pepper.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Cauliflower mash",
        description: "Swap the potatoes for cauliflower for a lighter mash.",
        removes: ["yukon gold potato"],
        adds: [ing("cauliflower", 2, "head", "cut into florets")],
        extraSteps: [
          "Boil the cauliflower only 10 minutes, drain very well, and blend in the Vitamix (or mash) with the butter and just a splash of milk.",
        ],
      },
    ],
    pairsWith: [],
  },
  {
    slug: "baked-potatoes",
    title: "Baked Potatoes",
    description:
      "Crispy-skinned baked potatoes with a toppings spread. Mostly hands-off oven time.",
    kind: "side",
    cuisine: "American",
    tags: ["vegetarian", "kid_favorite", "american"],
    method: "oven",
    activeMinutes: 10,
    totalMinutes: 70,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: null,
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: 1,
    ingredients: [
      ing("russet potato", 5, "whole", "scrubbed"),
      ing("olive oil", 1, "tbsp"),
      ing("butter", 3, "tbsp", "for topping"),
      ing("sour cream", 0.5, "cup", "for topping"),
      ing("shredded cheddar", 0.5, "cup", "for topping"),
      ing("green onion", 2, "whole", "sliced, for topping", true),
      salt(),
    ],
    steps: [
      {
        text: "Heat the oven to 425°F. Scrub the potatoes and dry them well.",
      },
      {
        text: "Poke each potato several times with a fork (so steam can escape), rub with olive oil, and sprinkle with salt.",
      },
      {
        text: "Set them right on the oven rack and bake 50 to 60 minutes, until a fork slides in easily.",
        timerMinutes: 55,
      },
      {
        text: "Slice open the tops, squeeze the ends to fluff, and set out the toppings.",
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Sweet potatoes with yogurt",
        description: "Use sweet potatoes and top with Greek yogurt instead of sour cream.",
        removes: ["russet potato", "sour cream"],
        adds: [
          ing("sweet potato", 5, "whole", "scrubbed"),
          ing("plain greek yogurt", 0.5, "cup"),
        ],
        extraSteps: [
          "Put a sheet of foil on the rack below the sweet potatoes to catch any sugary drips.",
        ],
      },
    ],
    pairsWith: [],
  },
  {
    slug: "steamed-rice",
    title: "Steamed Rice",
    description: "Fluffy white rice that goes with just about everything.",
    kind: "side",
    cuisine: "American",
    tags: ["vegetarian"],
    method: "stovetop",
    activeMinutes: 5,
    totalMinutes: 30,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: null,
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "balanced",
    cooldownDays: 1,
    ingredients: [
      ing("long-grain white rice", 1.5, "cup"),
      ing("butter", 1, "tbsp", undefined, true),
      salt(),
    ],
    steps: [
      {
        text: "Rinse the rice in a mesh strainer under cold water for 30 seconds (this washes off extra starch so it isn't gummy).",
      },
      {
        text: "In a medium pot, bring 2 1/4 cups water, the butter, and 1/2 teaspoon salt to a boil. Stir in the rice.",
      },
      {
        text: "Turn the heat to the lowest setting, cover with a tight lid, and cook 18 minutes. No peeking; the steam is doing the work.",
        timerMinutes: 18,
      },
      {
        text: "Take the pot off the heat and let it sit, still covered, for 5 minutes. Fluff with a fork.",
        timerMinutes: 5,
      },
    ],
    variants: [
      {
        kind: "healthy",
        label: "Brown rice",
        description: "Use brown rice for more fiber. It takes about 20 minutes longer.",
        removes: ["long-grain white rice"],
        adds: [ing("brown rice", 1.5, "cup")],
        extraSteps: [
          "Use 3 cups water and cook covered on low for 40 to 45 minutes instead of 18.",
        ],
      },
    ],
    pairsWith: [],
  },
  {
    slug: "roasted-vegetables",
    title: "Roasted Vegetables",
    description:
      "Broccoli, carrots, and onion roasted until crispy at the edges. Roasting makes even broccoli skeptics reconsider.",
    kind: "side",
    cuisine: "American",
    tags: ["healthy", "vegetarian", "american"],
    method: "sheet_pan",
    activeMinutes: 10,
    totalMinutes: 35,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: null,
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "healthy",
    cooldownDays: 1,
    ingredients: [
      ing("broccoli", 1.5, "lb", "cut into florets"),
      ing("carrot", 4, "whole", "peeled, cut into sticks"),
      ing("red onion", 1, "whole", "cut into wedges"),
      ing("olive oil", 3, "tbsp"),
      ing("garlic powder", 1, "tsp"),
      ing("grated parmesan", 0.25, "cup", undefined, true),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the oven to 425°F.",
      },
      {
        text: "Toss the broccoli, carrots, and onion on a large sheet pan with the olive oil, garlic powder, 1 teaspoon salt, and some pepper. Spread them out in one layer so they roast instead of steam.",
      },
      {
        text: "Roast 20 to 25 minutes, stirring halfway, until tender and browned at the edges.",
        timerMinutes: 22,
      },
      {
        text: "Sprinkle with parmesan, if using, and serve.",
      },
    ],
    variants: [],
    pairsWith: [],
  },
  {
    slug: "grilled-vegetables",
    title: "Grilled Vegetables",
    description:
      "Zucchini, squash, peppers, and onion with smoky grill marks. Easy to cook alongside whatever else is on the grill.",
    kind: "side",
    cuisine: "American",
    tags: ["grilled", "healthy", "vegetarian", "american"],
    method: "grill",
    activeMinutes: 15,
    totalMinutes: 25,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: null,
    seasonFit: "warm",
    indoorMethod: "roast in the oven at 425°F for 20 to 25 minutes",
    healthCategory: "healthy",
    cooldownDays: 1,
    ingredients: [
      ing("zucchini", 2, "whole", "sliced lengthwise into 1/2-inch planks"),
      ing("yellow squash", 2, "whole", "sliced lengthwise into 1/2-inch planks"),
      ing("bell pepper", 2, "whole", "cut into wide flat pieces"),
      ing("red onion", 1, "whole", "cut into thick rounds"),
      ing("olive oil", 3, "tbsp"),
      ing("italian seasoning", 1, "tsp"),
      salt(),
      pepper(),
    ],
    steps: [
      {
        text: "Heat the grill to medium-high and scrape the grates clean.",
      },
      {
        text: "Toss the vegetables with the olive oil, Italian seasoning, 1 teaspoon salt, and some pepper. Big flat pieces won't fall through the grates.",
      },
      {
        text: "Grill 4 to 5 minutes per side, until tender with dark grill marks.",
        timerMinutes: 10,
      },
      {
        text: "Indoor option: spread on a sheet pan and roast at 425°F for 20 to 25 minutes, stirring halfway.",
      },
    ],
    variants: [],
    pairsWith: [],
  },
  {
    slug: "simple-green-salad",
    title: "Simple Green Salad",
    description: "A quick, crunchy salad that goes with anything. Ten minutes, zero cooking.",
    kind: "side",
    cuisine: "American",
    tags: ["healthy", "vegetarian", "american"],
    method: "no_cook",
    activeMinutes: 10,
    totalMinutes: 10,
    baseServings: 5,
    spiceLevel: 0,
    spiceSplit: null,
    seasonFit: "any",
    indoorMethod: null,
    healthCategory: "healthy",
    cooldownDays: 1,
    ingredients: [
      ing("mixed salad greens", 10, "oz"),
      ing("cucumber", 1, "whole", "sliced"),
      ing("cherry tomato", 1.5, "cup", "halved"),
      ing("carrot", 1, "whole", "shredded or thinly sliced"),
      ing("italian dressing", 0.5, "cup", "or your family's favorite"),
    ],
    steps: [
      {
        text: "If the greens aren't pre-washed, rinse them in cold water and spin or pat them dry (wet leaves make watery salad).",
      },
      {
        text: "Slice the cucumber, cut the cherry tomatoes in half, and shred the carrot on the large holes of a box grater.",
      },
      {
        text: "Put the greens in a large bowl and scatter the cucumber, tomatoes, and carrot on top.",
      },
      {
        text: "Right before serving, drizzle with dressing and toss. (Dressing it early makes the greens soggy.)",
      },
    ],
    variants: [],
    pairsWith: [],
  },
];
