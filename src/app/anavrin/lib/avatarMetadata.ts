import { ANAVRIN_CONFIG } from "../config/anavrinConfig";
import {
  EXPRESSION_OPTIONS,
  FRAME_OPTIONS,
  getOptionLabel,
  HAIR_COLOR_OPTIONS,
  HAIR_TYPE_OPTIONS,
  HEIGHT_OPTIONS,
  IDLE_STYLE_OPTIONS,
  STARTER_ACCESSORY_OPTIONS,
  STARTER_AURA_OPTIONS,
  STARTER_PANTS_OPTIONS,
  STARTER_SHOES_OPTIONS,
  STARTER_TOP_OPTIONS,
  STYLE_OPTIONS,
  VOICE_OPTIONS,
  WALK_STYLE_OPTIONS,
} from "./avatarSchema";
import type { AvatarDraft, AvatarMintMetadata } from "../types";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildAvatarSeed(draft: AvatarDraft): string {
  return [
    draft.appearance.frame_type,
    draft.appearance.skin_tone,
    draft.appearance.hair_type,
    draft.appearance.hair_color,
    draft.appearance.height_class,
    draft.appearance.body_type,
    draft.appearance.face_style,
    draft.appearance.eye_color,
    draft.appearance.eye_style,
    draft.appearance.mouth_style,
    draft.appearance.facial_hair,
    draft.behavior.expression_profile,
    draft.behavior.voice_type,
    draft.behavior.style_type,
    draft.behavior.idle_style,
    draft.behavior.walk_style,
    draft.behavior.base_emote_pack,
    draft.starter_style.top,
    draft.starter_style.pants,
    draft.starter_style.shoes,
    draft.starter_style.accessory,
    draft.starter_style.aura,
  ].join("-");
}

export function buildAvatarName(draft: AvatarDraft): string {
  const frame = getOptionLabel(FRAME_OPTIONS, draft.appearance.frame_type);
  const style = getOptionLabel(STYLE_OPTIONS, draft.behavior.style_type);
  const aura = getOptionLabel(STARTER_AURA_OPTIONS, draft.starter_style.aura);
  return `${frame} ${style} ${aura}`.slice(0, 32);
}

export function buildAvatarDescription(draft: AvatarDraft): string {
  const height = getOptionLabel(HEIGHT_OPTIONS, draft.appearance.height_class);
  const hair = getOptionLabel(HAIR_TYPE_OPTIONS, draft.appearance.hair_type);
  const hairColor = getOptionLabel(HAIR_COLOR_OPTIONS, draft.appearance.hair_color);
  const expression = getOptionLabel(EXPRESSION_OPTIONS, draft.behavior.expression_profile);
  const walk = getOptionLabel(WALK_STYLE_OPTIONS, draft.behavior.walk_style);
  const top = getOptionLabel(STARTER_TOP_OPTIONS, draft.starter_style.top);
  return `${height} frame with ${hairColor.toLowerCase()} ${hair.toLowerCase()}, ${expression.toLowerCase()} expression, ${walk.toLowerCase()} walk, starting in ${top}.`.slice(
    0,
    280
  );
}

export function buildAvatarAttributes(draft: AvatarDraft) {
  return [
    ["Frame", getOptionLabel(FRAME_OPTIONS, draft.appearance.frame_type)],
    ["Height", getOptionLabel(HEIGHT_OPTIONS, draft.appearance.height_class)],
    ["Hair Type", getOptionLabel(HAIR_TYPE_OPTIONS, draft.appearance.hair_type)],
    ["Hair Color", getOptionLabel(HAIR_COLOR_OPTIONS, draft.appearance.hair_color)],
    ["Expression", getOptionLabel(EXPRESSION_OPTIONS, draft.behavior.expression_profile)],
    ["Voice", getOptionLabel(VOICE_OPTIONS, draft.behavior.voice_type)],
    ["Idle Style", getOptionLabel(IDLE_STYLE_OPTIONS, draft.behavior.idle_style)],
    ["Walk Style", getOptionLabel(WALK_STYLE_OPTIONS, draft.behavior.walk_style)],
    ["Starter Top", getOptionLabel(STARTER_TOP_OPTIONS, draft.starter_style.top)],
    ["Starter Pants", getOptionLabel(STARTER_PANTS_OPTIONS, draft.starter_style.pants)],
    ["Starter Shoes", getOptionLabel(STARTER_SHOES_OPTIONS, draft.starter_style.shoes)],
    [
      "Starter Accessory",
      getOptionLabel(STARTER_ACCESSORY_OPTIONS, draft.starter_style.accessory),
    ],
    ["Starter Aura", getOptionLabel(STARTER_AURA_OPTIONS, draft.starter_style.aura)],
  ].map(([trait_type, value]) => ({ trait_type, value }));
}

export function buildAvatarUris(draft: AvatarDraft) {
  const seed = buildAvatarSeed(draft);
  const modelSlug = slugify(
    `${getOptionLabel(FRAME_OPTIONS, draft.appearance.frame_type)}-${getOptionLabel(
      STYLE_OPTIONS,
      draft.behavior.style_type
    )}`
  );
  const root = ANAVRIN_CONFIG.assets.baseUrl.replace(/\/$/, "");

  return {
    seed,
    image_url: `${root}/${ANAVRIN_CONFIG.assets.imagePath}/${seed}.png`,
    portrait_uri: `${root}/${ANAVRIN_CONFIG.assets.portraitPath}/${seed}.png`,
    base_model_uri: `${root}/${ANAVRIN_CONFIG.assets.modelPath}/${modelSlug}.glb`,
  };
}

export function buildAvatarMintMetadata(draft: AvatarDraft): AvatarMintMetadata {
  const uris = buildAvatarUris(draft);

  return {
    name: buildAvatarName(draft),
    description: buildAvatarDescription(draft),
    attributes: buildAvatarAttributes(draft),
    image_url: uris.image_url,
    portrait_uri: uris.portrait_uri,
    base_model_uri: uris.base_model_uri,
    seed: uris.seed,
  };
}
