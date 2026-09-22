import { z } from "zod";

export const AVATAR_EMOJIS = [
  "🍕", "🌮", "🍝", "🍔", "🥑", "🍩", "🧁", "🍓", "🥦", "🌽", "🍗", "🥐",
  "🍪", "🍉", "🧀", "🍜", "🥞", "🍟", "🌶️", "🥨", "🍦", "🥕", "🍋", "🦄",
  "🐻", "🦊", "🐸", "🐙", "🦖", "🐶", "🐦", "🦉", "📚", "🎮", "🛴", "⚽",
  "🏀", "🏐", "☕", "🎸", "🚀", "👑", "🧑‍🍳", "😎",
];

export const AVATAR_COLORS = [
  "#fca5a5", "#fdba74", "#fde68a", "#bef264", "#86efac", "#67e8f9",
  "#93c5fd", "#c4b5fd", "#f0abfc", "#f9a8d4", "#d6d3d1", "#fcd34d",
];

export const APPLIANCES = [
  { id: "grill", label: "Grill" },
  { id: "slow_cooker", label: "Slow cooker" },
  { id: "dutch_oven", label: "Dutch oven" },
  { id: "vitamix", label: "High-speed blender (Vitamix)" },
  { id: "air_fryer", label: "Air fryer" },
  { id: "instant_pot", label: "Instant Pot / pressure cooker" },
  { id: "sheet_pan", label: "Oven & sheet pans" },
] as const;

export const SPICE_LABELS = [
  "No heat at all",
  "Mild",
  "Medium",
  "Bring the heat",
] as const;

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.email().nullable());

export const memberInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(40),
    role: z.enum(["parent", "kid"]),
    birthYear: z.number().int().min(1900).max(2100).nullable(),
    avatarEmoji: z.string().min(1).max(16),
    avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    chefTitle: z.string().trim().max(60).nullable(),
    humorDial: z.enum(["goofball", "dry"]),
    spiceTolerance: z.number().int().min(0).max(3),
    prefersHighProtein: z.boolean(),
    wantsHealthySwaps: z.boolean(),
    defaultPresence: z.enum(["home", "away"]),
    authEmail: optionalEmail,
  })
  .refine((m) => m.role === "parent" || m.authEmail === null, {
    message: "Only parents sign in with an email",
    path: ["authEmail"],
  });
export type MemberInput = z.input<typeof memberInputSchema>;

export const settingsInputSchema = z.object({
  familyName: z.string().trim().min(1).max(60),
  homeZip: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().regex(/^\d{5}$/, "5-digit ZIP").nullable()),
  timezone: z.string().min(1),
  appliances: z.array(z.string()),
  weeknightActiveMinutes: z.number().int().min(10).max(120),
  healthyNightsTarget: z.number().int().min(0).max(7),
  defaultCooldownDays: z.number().int().min(1).max(60),
  chaosSliceEnabled: z.boolean(),
  weekStartsOn: z.number().int().min(0).max(6).default(0),
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

export const setupInputSchema = z.object({
  settings: settingsInputSchema,
  members: z.array(memberInputSchema).min(1),
  starterSlugs: z.array(z.string()),
});
export type SetupInput = z.input<typeof setupInputSchema>;

export function defaultMember(role: "parent" | "kid", index: number): MemberInput {
  return {
    name: "",
    role,
    birthYear: null,
    avatarEmoji: AVATAR_EMOJIS[index % AVATAR_EMOJIS.length],
    avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
    chefTitle: null,
    humorDial: role === "parent" ? "dry" : "goofball",
    spiceTolerance: 1,
    prefersHighProtein: false,
    wantsHealthySwaps: role === "parent",
    defaultPresence: "home",
    authEmail: "",
  };
}
