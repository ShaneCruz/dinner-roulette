/** A food emoji for a cuisine or dish name, for wheels and cards. */
const CUISINE_EMOJI: [RegExp, string][] = [
  [/soup|stew|chili/i, "🍲"],
  [/breakfast|brunch/i, "🥞"],
  [/steak|beef|pot roast/i, "🥩"],
  [/salad/i, "🥗"],
  [/fish|seafood|salmon|shrimp/i, "🐟"],
  [/mex|taco|burrito/i, "🌮"],
  [/pizza/i, "🍕"],
  [/ital|pasta/i, "🍝"],
  [/chin|asian|thai|viet|pho/i, "🥡"],
  [/jap|sushi|ramen/i, "🍣"],
  [/burger|american|diner/i, "🍔"],
  [/greek|mediter/i, "🥙"],
  [/indian|curry/i, "🍛"],
  [/bbq|barbecue|wings|chicken/i, "🍗"],
  [/sandwich|deli|sub/i, "🥪"],
];

export function cuisineEmoji(cuisine: string) {
  return CUISINE_EMOJI.find(([re]) => re.test(cuisine))?.[1] ?? "🍽️";
}
