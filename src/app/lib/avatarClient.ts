import type { SuiClient } from "@mysten/sui/client";

import { AVATAR_CONTRACT, AVATAR_TYPES } from "./avatarContract";

export type AvatarMintConfig = {
  objectId: string;
  objectType: string;
  mintEnabled: boolean;
  mintPriceMist: string;
  treasuryBalanceMist: string | null;
  ownerKind: "shared" | "address" | "immutable" | "unknown";
};

export type AvatarAdminState = {
  objectId: string;
  objectType: string;
  ownerAddress: string | null;
  connectedIsAdmin: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function readString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return fallback;
}

function parseOwnerKind(owner: unknown): AvatarMintConfig["ownerKind"] {
  const record = asRecord(owner);
  if ("Shared" in record) return "shared";
  if ("AddressOwner" in record) return "address";
  if ("Immutable" in record) return "immutable";
  return "unknown";
}

function parseAddressOwner(owner: unknown): string | null {
  const record = asRecord(owner);
  const direct = record.AddressOwner;
  return typeof direct === "string" ? direct : null;
}

export async function fetchAvatarMintConfig(client: SuiClient): Promise<AvatarMintConfig> {
  const response = await client.getObject({
    id: AVATAR_CONTRACT.mintConfigId,
    options: {
      showContent: true,
      showOwner: true,
      showType: true,
    },
  });

  const data = response.data;
  if (!data) {
    throw new Error("MintConfig object was not found on chain.");
  }

  if (data.type !== AVATAR_TYPES.mintConfig) {
    throw new Error(`Unexpected MintConfig type: ${data.type}`);
  }

  const content = asRecord(data.content);
  const fields = asRecord(content.fields);

  return {
    objectId: data.objectId,
    objectType: data.type,
    mintEnabled: Boolean(fields.mint_enabled),
    mintPriceMist: readString(fields.mint_price_mist, "0"),
    treasuryBalanceMist: fields.treasury === undefined ? null : readString(fields.treasury, "0"),
    ownerKind: parseOwnerKind(data.owner),
  };
}

export async function fetchAvatarAdminState(
  client: SuiClient,
  connectedAddress?: string | null
): Promise<AvatarAdminState> {
  const response = await client.getObject({
    id: AVATAR_CONTRACT.adminCapId,
    options: {
      showOwner: true,
      showType: true,
    },
  });

  const data = response.data;
  if (!data) {
    throw new Error("AdminCap object was not found on chain.");
  }

  if (data.type !== AVATAR_TYPES.adminCap) {
    throw new Error(`Unexpected AdminCap type: ${data.type}`);
  }

  const ownerAddress = parseAddressOwner(data.owner);
  const normalizedOwner = ownerAddress?.toLowerCase();
  const normalizedConnected = connectedAddress?.toLowerCase();

  return {
    objectId: data.objectId,
    objectType: data.type,
    ownerAddress,
    connectedIsAdmin: Boolean(
      normalizedOwner && normalizedConnected && normalizedOwner === normalizedConnected
    ),
  };
}
