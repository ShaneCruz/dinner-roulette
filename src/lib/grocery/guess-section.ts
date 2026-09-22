import type { StoreSection } from "@/lib/recipes/schema";

// Good-enough guesses for hand-typed items ("milk", "paper towels").
// Anything unknown lands in Other, and the shopper can live with that.
const KEYWORDS: [StoreSection, string[]][] = [
  ["produce", ["apple", "banana", "berr", "lettuce", "spinach", "onion", "potato", "tomato", "pepper", "carrot", "celery", "cucumber", "avocado", "lemon", "lime", "orange", "grape", "broccoli", "zucchini", "garlic", "cilantro", "parsley", "basil", "mushroom", "corn", "fruit", "salad"]],
  ["meat", ["chicken", "beef", "steak", "pork", "sausage", "bacon", "turkey", "ham", "lamb"]],
  ["seafood", ["salmon", "shrimp", "tuna", "fish", "cod", "tilapia"]],
  ["dairy", ["milk", "cheese", "yogurt", "butter", "cream", "egg", "sour cream", "cottage"]],
  ["bakery", ["bread", "bun", "roll", "bagel", "tortilla", "pita", "muffin"]],
  ["frozen", ["frozen", "ice cream", "popsicle", "waffle"]],
  ["spices", ["salt", "pepper flakes", "cumin", "paprika", "oregano", "cinnamon", "spice", "seasoning", "oil", "vinegar"]],
  ["pantry", ["rice", "pasta", "noodle", "flour", "sugar", "cereal", "oat", "bean", "sauce", "broth", "soup", "can", "peanut", "jelly", "chips", "cracker", "coffee", "tea", "snack"]],
  ["other", ["paper", "towel", "soap", "detergent", "trash", "foil", "wrap", "napkin", "tissue", "toilet", "shampoo", "dog", "cat"]],
];

export function guessSection(name: string): StoreSection {
  const lower = name.toLowerCase();
  for (const [section, words] of KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return section;
  }
  return "other";
}
