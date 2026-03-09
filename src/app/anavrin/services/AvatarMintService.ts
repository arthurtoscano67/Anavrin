import { bcs } from "@mysten/sui/bcs";
import type { SuiClient, SuiObjectResponse } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

import {
  ANAVRIN_CONFIG,
  ANAVRIN_TARGETS,
  ANAVRIN_TYPES,
} from "../config/anavrinConfig";
import { buildAvatarMintMetadata } from "../lib/avatarMetadata";
import type {
  ActiveIdentity,
  AvatarAttribute,
  AvatarDraft,
  AvatarMintMetadata,
  MintConfigState,
} from "../types";

const AttributeBcs = bcs.struct("Attribute", {
  trait_type: bcs.string(),
  value: bcs.string(),
});

const AttributeVectorBcs = bcs.vector(AttributeBcs);

function objectFields(response: SuiObjectResponse) {
  const content = response.data?.content as
    | { dataType?: string; fields?: Record<string, unknown> }
    | undefined;

  if (content?.dataType !== "moveObject" || !content.fields) {
    throw new Error("Expected a Move object response.");
  }

  return content.fields;
}

function ownerKind(response: SuiObjectResponse) {
  const owner = response.data?.owner;
  if (!owner) return "unknown";
  if (typeof owner === "string") return owner;
  if ("Shared" in owner) return "shared";
  if ("AddressOwner" in owner) return "address";
  if ("ObjectOwner" in owner) return "object";
  return "unknown";
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function readStarterStyle(attributes: AvatarAttribute[]) {
  const valueFor = (trait: string, fallback: string) =>
    attributes.find((item) => item.trait_type === trait)?.value ?? fallback;

  return {
    top: valueFor("Starter Top", "brooklyn-hoodie"),
    pants: valueFor("Starter Pants", "cargo-tech"),
    shoes: valueFor("Starter Shoes", "runner-carbon"),
    accessory: valueFor("Starter Accessory", "none"),
    aura: valueFor("Starter Aura", "city-neon"),
  };
}

export function buildMintAvatarTransaction(draft: AvatarDraft): {
  transaction: Transaction;
  metadata: AvatarMintMetadata;
} {
  const metadata = buildAvatarMintMetadata(draft);
  const transaction = new Transaction();

  transaction.moveCall({
    target: ANAVRIN_TARGETS.mintAvatarFree,
    arguments: [
      transaction.object(ANAVRIN_CONFIG.mintConfigId),
      transaction.pure.string(metadata.name),
      transaction.pure.string(metadata.description),
      transaction.pure.string(metadata.image_url),
      transaction.pure(AttributeVectorBcs.serialize(metadata.attributes)),
      transaction.pure.u8(draft.appearance.frame_type),
      transaction.pure.u8(draft.appearance.skin_tone),
      transaction.pure.u8(draft.appearance.hair_type),
      transaction.pure.u8(draft.appearance.hair_color),
      transaction.pure.u8(draft.appearance.height_class),
      transaction.pure.u8(draft.appearance.body_type),
      transaction.pure.u8(draft.appearance.face_style),
      transaction.pure.u8(draft.appearance.eye_color),
      transaction.pure.u8(draft.appearance.eye_style),
      transaction.pure.u8(draft.appearance.mouth_style),
      transaction.pure.u8(draft.appearance.facial_hair),
      transaction.pure.u8(draft.behavior.expression_profile),
      transaction.pure.u8(draft.behavior.voice_type),
      transaction.pure.u8(draft.behavior.style_type),
      transaction.pure.u8(draft.behavior.idle_style),
      transaction.pure.u8(draft.behavior.walk_style),
      transaction.pure.u8(draft.behavior.base_emote_pack),
      transaction.pure.string(metadata.base_model_uri),
      transaction.pure.string(metadata.portrait_uri),
    ],
  });

  return { transaction, metadata };
}

export async function readMintConfig(client: SuiClient): Promise<MintConfigState> {
  const response = await client.getObject({
    id: ANAVRIN_CONFIG.mintConfigId,
    options: {
      showContent: true,
      showOwner: true,
    },
  });

  const fields = objectFields(response);
  return {
    objectId: response.data?.objectId ?? ANAVRIN_CONFIG.mintConfigId,
    ownerKind: ownerKind(response),
    mintPriceMist: String(fields.mint_price_mist ?? "0"),
    mintEnabled: Boolean(fields.mint_enabled),
    treasuryBalanceMist: String(fields.treasury ?? "0"),
  };
}

export async function readAdminCapOwner(client: SuiClient): Promise<string | null> {
  const response = await client.getObject({
    id: ANAVRIN_CONFIG.adminCapId,
    options: {
      showOwner: true,
    },
  });

  const owner = response.data?.owner;
  if (owner && typeof owner !== "string" && "AddressOwner" in owner) {
    return owner.AddressOwner;
  }

  return null;
}

export async function readAvatarIdentity(
  client: SuiClient,
  objectId: string
): Promise<ActiveIdentity> {
  const response = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
      showType: true,
    },
  });

  const fields = objectFields(response);
  const owner = response.data?.owner;
  const rawAttributes = Array.isArray(fields.attributes)
    ? (fields.attributes as Array<Record<string, unknown>>)
    : [];
  const attributes: AvatarAttribute[] = rawAttributes.map((item) => ({
    trait_type: String(item.trait_type ?? ""),
    value: String(item.value ?? ""),
  }));
  const appearance = fields.appearance as Record<string, unknown>;
  const behavior = fields.behavior as Record<string, unknown>;

  return {
    objectId,
    owner:
      owner && typeof owner !== "string" && "AddressOwner" in owner
        ? owner.AddressOwner
        : "unknown",
    name: String(fields.name ?? ""),
    description: String(fields.description ?? ""),
    imageUrl: String(fields.image_url ?? ""),
    portraitUri: String(fields.portrait_uri ?? ""),
    baseModelUri: String(fields.base_model_uri ?? ""),
    level: Number(fields.level ?? 0),
    xp: Number(fields.xp ?? 0),
    objectType: response.data?.type ?? ANAVRIN_TYPES.avatar,
    draft: {
      appearance: {
        frame_type: asNumber(appearance?.frame_type),
        skin_tone: asNumber(appearance?.skin_tone),
        hair_type: asNumber(appearance?.hair_type),
        hair_color: asNumber(appearance?.hair_color),
        height_class: asNumber(appearance?.height_class),
        body_type: asNumber(appearance?.body_type),
        face_style: asNumber(appearance?.face_style),
        eye_color: asNumber(appearance?.eye_color),
        eye_style: asNumber(appearance?.eye_style),
        mouth_style: asNumber(appearance?.mouth_style),
        facial_hair: asNumber(appearance?.facial_hair),
      },
      behavior: {
        expression_profile: asNumber(behavior?.expression_profile),
        voice_type: asNumber(behavior?.voice_type),
        style_type: asNumber(behavior?.style_type),
        idle_style: asNumber(behavior?.idle_style),
        walk_style: asNumber(behavior?.walk_style),
        base_emote_pack: asNumber(behavior?.base_emote_pack),
      },
      starter_style: readStarterStyle(attributes),
    },
  };
}
