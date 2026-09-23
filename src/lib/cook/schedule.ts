import type { StepInput } from "@/lib/recipes/schema";

/**
 * One timeline for a whole dinner. Each dish is scheduled backwards from the
 * time you want to eat, so the sides land with the main instead of half an
 * hour late. Waiting steps use the recipe's own timer; hands-on steps share
 * out the recipe's hands-on minutes, so the times are a good guide rather
 * than a promise.
 */

export type Dish = {
  id: string;
  title: string;
  slug: string;
  steps: StepInput[];
  activeMinutes: number;
  totalMinutes: number;
};

export type ScheduledStep = {
  dishId: string;
  dish: string;
  slug: string;
  stepNumber: number;
  text: string;
  timerMinutes?: number;
  /** Minutes before serving that this step starts */
  startsAt: number;
  minutes: number;
};

const MIN_STEP = 2;

/** How long each step takes, in order. */
export function stepDurations(dish: Dish): number[] {
  const handsOn = dish.steps.filter((s) => !s.timerMinutes).length;
  const each = handsOn ? Math.max(MIN_STEP, Math.round(dish.activeMinutes / handsOn)) : 0;
  const durations = dish.steps.map((s) => s.timerMinutes ?? each);
  const planned = durations.reduce((a, b) => a + b, 0);
  // Recipes often leave resting or preheating out of the steps; put any
  // missing time into the longest wait so the dish still takes as long as it says.
  const missing = dish.totalMinutes - planned;
  if (missing > 0 && durations.length) {
    const longest = durations.indexOf(Math.max(...durations));
    durations[longest] += missing;
  }
  return durations;
}

/** Everything to do, earliest first, with minutes before serving. */
export function cookingPlan(dishes: Dish[]): ScheduledStep[] {
  const steps: ScheduledStep[] = [];
  for (const dish of dishes) {
    const durations = stepDurations(dish);
    // Walk backwards: the last step finishes as you serve.
    let endsAt = 0;
    for (let i = dish.steps.length - 1; i >= 0; i--) {
      const minutes = durations[i];
      steps.push({
        dishId: dish.id,
        dish: dish.title,
        slug: dish.slug,
        stepNumber: i + 1,
        text: dish.steps[i].text,
        ...(dish.steps[i].timerMinutes ? { timerMinutes: dish.steps[i].timerMinutes } : {}),
        startsAt: endsAt + minutes,
        minutes,
      });
      endsAt += minutes;
    }
  }
  return steps.sort((a, b) => b.startsAt - a.startsAt || a.dish.localeCompare(b.dish) || a.stepNumber - b.stepNumber);
}

/** When to start cooking: minutes before serving. */
export function startsCookingAt(dishes: Dish[]): number {
  return Math.max(0, ...dishes.map((d) => Math.max(d.totalMinutes, stepDurations(d).reduce((a, b) => a + b, 0))));
}

/** "6:30 PM" for a step that starts `minutesBefore` before serving. */
export function clockAt(serveMinutes: number, minutesBefore: number): string {
  const total = ((serveMinutes - minutesBefore) % (24 * 60) + 24 * 60) % (24 * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}
