/**
 * Every playful line in the app, in two tones. "goofball" is for younger
 * kids; "dry" is for teens and grown-ups who will judge anything too cute.
 * Families can edit these freely: add inside jokes, remove what falls flat.
 */
export type Tone = "goofball" | "dry";

type Line = Record<Tone, string[]>;

const lines = {
  greetingMorning: {
    goofball: ["Good morning, {name}! Your tummy called. It has DINNER QUESTIONS."],
    dry: ["Morning, {name}. Dinner is still hours away. Planning ahead, respect."],
  },
  greetingAfternoon: {
    goofball: [
      "Hey {name}! The pots and pans are doing warm-up stretches.",
      "{name}! Quick, act natural. The broccoli is watching.",
    ],
    dry: ["Afternoon, {name}. Dinner is a problem future-you will thank you for solving."],
  },
  greetingEvening: {
    goofball: [
      "It's dinner o'clock, {name}! Spoons ready. Forks ready. FACE ready.",
      "{name}! The kitchen has been expecting you.",
    ],
    dry: [
      "Evening, {name}. Let's get dinner handled.",
      "Hi {name}. The kitchen is open. Mostly.",
    ],
  },
  whoIsHere: {
    goofball: ["Who's hungry? Tap your face!"],
    dry: ["Who's using the app?"],
  },
  noRecipesFound: {
    goofball: ["Nothing here! The recipes are playing hide and seek. They're winning."],
    dry: ["No recipes match. Try a different search."],
  },
  wrongPin: {
    goofball: ["Nope! Wrong PIN. Are you a secret agent? Try again!"],
    dry: ["That PIN didn't work. Try again."],
  },
  comingHome: {
    goofball: ["{name} is coming home in {days}! Roll out the red carpet (or at least a clean plate)."],
    dry: ["{name} is home in {days}. {name} gets first pick."],
  },
  rateAsk: {
    goofball: ["Be honest. The broccoli can take it."],
    dry: ["Be honest. It helps the planner."],
  },
  ratePrompt: {
    goofball: ["How was {dinner}? The chef is nervously waiting.", "Rate {dinner}! Was it a 🤩 or a 😖?"],
    dry: ["How was {dinner}? Takes ten seconds.", "Quick verdict on {dinner}?"],
  },
  suggestIntro: {
    goofball: ["The dinner robot has thoughts. Beep boop. 🤖"],
    dry: ["Suggestions, based on who's home and what you've liked."],
  },
  homeToday: {
    goofball: ["{name} is HOME! The family is complete. Dinner just got 20% louder."],
    dry: ["{name} is home. Welcome back."],
  },
} satisfies Record<string, Line>;

export type LineKey = keyof typeof lines;

/** Picks a line (stable per `seed`, so it doesn't flicker between renders). */
export function say(
  key: LineKey,
  tone: Tone,
  vars: Record<string, string | number> = {},
  seed = 0,
): string {
  const options = lines[key][tone];
  const template = options[Math.abs(seed) % options.length];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}

export function greetingKey(hour: number): LineKey {
  if (hour < 12) return "greetingMorning";
  if (hour < 16) return "greetingAfternoon";
  return "greetingEvening";
}
