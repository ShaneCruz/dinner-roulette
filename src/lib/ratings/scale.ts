export const FACES = [
  { stars: 1, emoji: "😖", label: "Never again" },
  { stars: 2, emoji: "😕", label: "Meh" },
  { stars: 3, emoji: "😐", label: "It was fine" },
  { stars: 4, emoji: "😋", label: "Yum" },
  { stars: 5, emoji: "🤩", label: "Make it every week" },
] as const;

export function faceFor(stars: number) {
  return FACES[Math.min(Math.max(Math.round(stars), 1), 5) - 1];
}

export const REASONS = [
  { id: "more_please", label: "More please", emoji: "🙌", positive: true },
  { id: "great_leftovers", label: "Great leftovers", emoji: "🥡", positive: true },
  { id: "easy_to_make", label: "Easy to make", emoji: "👌", positive: true },
  { id: "too_spicy", label: "Too spicy", emoji: "🥵", positive: false },
  { id: "too_bland", label: "Too bland", emoji: "🥱", positive: false },
  { id: "mushy", label: "Mushy", emoji: "🫠", positive: false },
  { id: "dry", label: "Too dry", emoji: "🏜️", positive: false },
  { id: "weird_texture", label: "Weird texture", emoji: "🤔", positive: false },
  { id: "too_much_work", label: "Too much work", emoji: "😮‍💨", positive: false },
] as const;

export type ReasonId = (typeof REASONS)[number]["id"];
export const REASON_IDS = REASONS.map((r) => r.id) as [ReasonId, ...ReasonId[]];

export function reasonLabel(id: string): string {
  const reason = REASONS.find((r) => r.id === id);
  return reason ? `${reason.emoji} ${reason.label}` : id;
}
