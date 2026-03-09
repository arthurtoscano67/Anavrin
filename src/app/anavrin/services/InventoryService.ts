import type { SuiClient } from "@mysten/sui/client";

import { ANAVRIN_CONFIG, ANAVRIN_TYPES } from "../config/anavrinConfig";
import type { ActiveIdentity } from "../types";
import { readAvatarIdentity } from "./AvatarMintService";

type IdentityIndex = Record<string, string>;

function readIdentityIndex(): IdentityIndex {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(ANAVRIN_CONFIG.storageKeys.activeIdentity);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as IdentityIndex;
  } catch {
    return {};
  }
}

function writeIdentityIndex(index: IdentityIndex) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ANAVRIN_CONFIG.storageKeys.activeIdentity,
    JSON.stringify(index)
  );
}

export function getStoredActiveIdentityId(address: string | null | undefined) {
  if (!address) return null;
  return readIdentityIndex()[address] ?? null;
}

export function setStoredActiveIdentityId(address: string, objectId: string) {
  const next = readIdentityIndex();
  next[address] = objectId;
  writeIdentityIndex(next);
}

export async function readOwnedAvatars(client: SuiClient, owner: string) {
  const response = await client.getOwnedObjects({
    owner,
    filter: { StructType: ANAVRIN_TYPES.avatar },
    options: { showType: true },
  });

  return Promise.all(
    response.data
      .map((item) => item.data?.objectId)
      .filter((value): value is string => Boolean(value))
      .map((objectId) => readAvatarIdentity(client, objectId))
  );
}

export async function resolveActiveIdentity(
  client: SuiClient,
  owner: string
): Promise<ActiveIdentity | null> {
  const storedObjectId = getStoredActiveIdentityId(owner);

  if (storedObjectId) {
    try {
      return await readAvatarIdentity(client, storedObjectId);
    } catch {
      // Fall through to the first owned avatar if the stored object disappeared.
    }
  }

  const avatars = await readOwnedAvatars(client, owner);
  if (avatars.length === 0) return null;

  setStoredActiveIdentityId(owner, avatars[0].objectId);
  return avatars[0];
}
