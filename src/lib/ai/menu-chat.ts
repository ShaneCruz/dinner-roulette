import "server-only";
import type { RestaurantDish } from "@/db/schema";
import { chat } from "./claude";
import type { ChatTurn } from "./kitchen";

/**
 * Questions about a restaurant's menu, for the moment you're bored of your
 * usual and want someone who has read the whole thing to point somewhere.
 * It sees every dish we hold, who's eating, and what they normally order —
 * so "something like my usual but lighter" is a question it can actually
 * answer.
 */

export type MenuChatContext = {
  restaurantName: string;
  dishes: RestaurantDish[];
  /** Who's eating tonight, with the heat they'll take and what they never eat */
  diners: { name: string; spice: string; nopes: string[]; usual: string | null }[];
};

function describeMenu(dishes: RestaurantDish[]): string {
  return dishes
    .map((d) => {
      const bits = [d.name, d.price].filter(Boolean).join(" — ");
      return d.description ? `${bits}: ${d.description}` : bits;
    })
    .join("\n");
}

export async function askAboutMenu(context: MenuChatContext, history: ChatTurn[]): Promise<string> {
  const diners = context.diners.length
    ? context.diners
        .map((d) => {
          const bits = [d.spice, d.nopes.length ? `never eats: ${d.nopes.join(", ")}` : "", d.usual ? `usually orders ${d.usual}` : ""]
            .filter(Boolean)
            .join("; ");
          return `- ${d.name}: ${bits || "no preferences saved"}`;
        })
        .join("\n")
    : "Nobody's preferences are saved yet.";

  return chat({
    feature: "menu questions",
    system: `You help one family order from ${context.restaurantName}. You have their full menu below.

Recommend only dishes that appear on the menu, by their exact name, and give the price when we have it. Two or three suggestions is plenty; say in a few words why each one fits what they asked. Keep the whole reply under about 120 words.

When someone says what they usually get, don't recommend that dish back to them — suggest things near it and say how they differ. Respect what people never eat, and remember the mildest eater when heat is involved. If nothing on the menu fits, say so plainly rather than stretching a dish to fit.

The menu:
${describeMenu(context.dishes)}

Eating tonight:
${diners}`,
    messages: history.slice(-8),
    maxTokens: 700,
  });
}
