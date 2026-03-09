import type { AvatarDraft, AvatarOption } from "../types";

export const FRAME_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Masculine", description: "Sharper shoulder line and broader stance." },
  { value: 1, label: "Feminine", description: "Tapered silhouette and softer center of mass." },
];

export const SKIN_TONE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Light Peach", swatch: "#f6d4be" },
  { value: 1, label: "Peach", swatch: "#f0bf9a" },
  { value: 2, label: "Peach Brown", swatch: "#c78f67" },
  { value: 3, label: "Brown", swatch: "#8e5d3a" },
  { value: 4, label: "Dark Brown", swatch: "#5d3923" },
];

export const HAIR_TYPE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Bald" },
  { value: 1, label: "Short Crop" },
  { value: 2, label: "Long Flow" },
  { value: 3, label: "Curly" },
  { value: 4, label: "Braids" },
  { value: 5, label: "Locs" },
  { value: 6, label: "Ponytail" },
  { value: 7, label: "Buzz" },
  { value: 8, label: "Wavy" },
];

export const HAIR_COLOR_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Black", swatch: "#101114" },
  { value: 1, label: "Dark Brown", swatch: "#34231c" },
  { value: 2, label: "Brown", swatch: "#694737" },
  { value: 3, label: "Light Brown", swatch: "#8b6a52" },
  { value: 4, label: "Blonde", swatch: "#cda85a" },
  { value: 5, label: "Red", swatch: "#a34324" },
  { value: 6, label: "Gray", swatch: "#8f9398" },
  { value: 7, label: "White Silver", swatch: "#d4d6da" },
  { value: 8, label: "Blue", swatch: "#2466bc" },
  { value: 9, label: "Pink", swatch: "#d25b8b" },
];

export const HEIGHT_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Short" },
  { value: 1, label: "Average" },
  { value: 2, label: "Tall" },
];

export const BODY_TYPE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Slim" },
  { value: 1, label: "Athletic" },
  { value: 2, label: "Heavy" },
];

export const FACE_STYLE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Face 1" },
  { value: 1, label: "Face 2" },
  { value: 2, label: "Face 3" },
  { value: 3, label: "Face 4" },
  { value: 4, label: "Face 5" },
  { value: 5, label: "Face 6" },
];

export const EYE_COLOR_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Brown", swatch: "#654329" },
  { value: 1, label: "Dark Brown", swatch: "#362014" },
  { value: 2, label: "Hazel", swatch: "#6f7c3c" },
  { value: 3, label: "Blue", swatch: "#5d9ee7" },
  { value: 4, label: "Green", swatch: "#5ba25d" },
  { value: 5, label: "Gray", swatch: "#98a2b3" },
];

export const EYE_STYLE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Round" },
  { value: 1, label: "Almond" },
  { value: 2, label: "Sharp" },
  { value: 3, label: "Soft" },
  { value: 4, label: "Sleepy" },
  { value: 5, label: "Wide" },
];

export const MOUTH_STYLE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Neutral" },
  { value: 1, label: "Soft Smile" },
  { value: 2, label: "Full" },
  { value: 3, label: "Thin" },
  { value: 4, label: "Defined" },
  { value: 5, label: "Youthful" },
];

export const FACIAL_HAIR_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Mustache" },
  { value: 2, label: "Goatee" },
  { value: 3, label: "Short Beard" },
  { value: 4, label: "Full Beard" },
];

export const EXPRESSION_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Calm" },
  { value: 1, label: "Confident" },
  { value: 2, label: "Playful" },
  { value: 3, label: "Serious" },
  { value: 4, label: "Aggressive" },
  { value: 5, label: "Shy" },
];

export const VOICE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Calm" },
  { value: 1, label: "Energetic" },
  { value: 2, label: "Deep" },
  { value: 3, label: "Playful" },
  { value: 4, label: "Robotic" },
  { value: 5, label: "Mysterious" },
];

export const STYLE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Street" },
  { value: 1, label: "Tactical" },
  { value: 2, label: "Luxury" },
  { value: 3, label: "Sporty" },
  { value: 4, label: "Futuristic" },
  { value: 5, label: "Casual" },
];

export const IDLE_STYLE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Relaxed" },
  { value: 1, label: "Alert" },
  { value: 2, label: "Tough" },
  { value: 3, label: "Heroic" },
  { value: 4, label: "Sneaky" },
];

export const WALK_STYLE_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Normal" },
  { value: 1, label: "Swagger" },
  { value: 2, label: "Stealth" },
  { value: 3, label: "Heavy" },
  { value: 4, label: "Confident" },
];

export const EMOTE_PACK_OPTIONS: AvatarOption<number>[] = [
  { value: 0, label: "Basic" },
  { value: 1, label: "Fun" },
  { value: 2, label: "Fighter" },
  { value: 3, label: "Hero" },
  { value: 4, label: "Villain" },
];

export const STARTER_TOP_OPTIONS: AvatarOption<string>[] = [
  { value: "soho-jacket", label: "Soho Jacket" },
  { value: "brooklyn-hoodie", label: "Brooklyn Hoodie" },
  { value: "midtown-blazer", label: "Midtown Blazer" },
  { value: "uptown-vest", label: "Uptown Vest" },
];

export const STARTER_PANTS_OPTIONS: AvatarOption<string>[] = [
  { value: "cargo-tech", label: "Cargo Tech" },
  { value: "tailored-black", label: "Tailored Black" },
  { value: "denim-dark", label: "Dark Denim" },
  { value: "track-slate", label: "Slate Track" },
];

export const STARTER_SHOES_OPTIONS: AvatarOption<string>[] = [
  { value: "runner-carbon", label: "Carbon Runners" },
  { value: "lux-loafers", label: "Lux Loafers" },
  { value: "court-white", label: "Court White" },
  { value: "combat-onyx", label: "Combat Onyx" },
];

export const STARTER_ACCESSORY_OPTIONS: AvatarOption<string>[] = [
  { value: "none", label: "No Accessory" },
  { value: "chain-silver", label: "Silver Chain" },
  { value: "visor-black", label: "Black Visor" },
  { value: "crossbody-tech", label: "Tech Crossbody" },
];

export const STARTER_AURA_OPTIONS: AvatarOption<string>[] = [
  { value: "city-neon", label: "City Neon" },
  { value: "platinum-haze", label: "Platinum Haze" },
  { value: "empire-amber", label: "Empire Amber" },
  { value: "downtown-mint", label: "Downtown Mint" },
];

export const DEFAULT_AVATAR_DRAFT: AvatarDraft = {
  appearance: {
    frame_type: 0,
    skin_tone: 1,
    hair_type: 1,
    hair_color: 0,
    height_class: 1,
    body_type: 1,
    face_style: 2,
    eye_color: 0,
    eye_style: 1,
    mouth_style: 1,
    facial_hair: 0,
  },
  behavior: {
    expression_profile: 1,
    voice_type: 0,
    style_type: 0,
    idle_style: 1,
    walk_style: 1,
    base_emote_pack: 0,
  },
  starter_style: {
    top: "brooklyn-hoodie",
    pants: "cargo-tech",
    shoes: "runner-carbon",
    accessory: "chain-silver",
    aura: "city-neon",
  },
};

export function getOptionLabel<T extends number | string>(
  options: AvatarOption<T>[],
  value: T
): string {
  return options.find((option) => option.value === value)?.label ?? String(value);
}

export const STYLE_LABELS = {
  frame_type: FRAME_OPTIONS,
  skin_tone: SKIN_TONE_OPTIONS,
  hair_type: HAIR_TYPE_OPTIONS,
  hair_color: HAIR_COLOR_OPTIONS,
  height_class: HEIGHT_OPTIONS,
  body_type: BODY_TYPE_OPTIONS,
  face_style: FACE_STYLE_OPTIONS,
  eye_color: EYE_COLOR_OPTIONS,
  eye_style: EYE_STYLE_OPTIONS,
  mouth_style: MOUTH_STYLE_OPTIONS,
  facial_hair: FACIAL_HAIR_OPTIONS,
  expression_profile: EXPRESSION_OPTIONS,
  voice_type: VOICE_OPTIONS,
  style_type: STYLE_OPTIONS,
  idle_style: IDLE_STYLE_OPTIONS,
  walk_style: WALK_STYLE_OPTIONS,
  base_emote_pack: EMOTE_PACK_OPTIONS,
  top: STARTER_TOP_OPTIONS,
  pants: STARTER_PANTS_OPTIONS,
  shoes: STARTER_SHOES_OPTIONS,
  accessory: STARTER_ACCESSORY_OPTIONS,
  aura: STARTER_AURA_OPTIONS,
} as const;
