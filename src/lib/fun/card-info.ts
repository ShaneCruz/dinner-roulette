/** Card names and blurbs, safe to use in the browser. */
export type CardType = "veto" | "double_down" | "respin" | "chefs_pick";

export const CARDS: Record<CardType, { emoji: string; label: string; blurb: string }> = {
  veto: { emoji: "🚫", label: "Veto", blurb: "Knock one dinner off this week's list. One per kid, every week." },
  double_down: { emoji: "⏫", label: "Double Down", blurb: "Your next 😍 in the swipe round counts double." },
  respin: { emoji: "🔄", label: "Respin", blurb: "Didn't like where the dinner wheel landed? Spin again." },
  chefs_pick: { emoji: "👨‍🍳", label: "Chef's Pick", blurb: "Choose any dinner for one night this week." },
};


/**
 * Dinners a person chose on purpose (Chef's Pick, a wheel spin) carry a
 * reason starting with one of these, so re-planning leaves them alone.
 */
const LOCKED_MARKS = ["👨‍🍳", "🎡", "🎲"];

export function isLockedPick(reason: string | null | undefined): boolean {
  return Boolean(reason && LOCKED_MARKS.some((mark) => reason.startsWith(mark)));
}
