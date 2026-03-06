import { KioskClient, Network } from "@mysten/kiosk";
import type { PaginatedEvents, SuiClient, SuiObjectData } from "@mysten/sui/client";

import {
  ACTIVE_PLAYER_EVENT_TYPES,
  ADMIN_CAP_TYPE,
  ARENA_MATCH_TYPE,
  MODULE,
  MONSTER_TYPE,
  PACKAGE_ID,
  TREASURY_ID,
} from "./sui_constants";
import type {
  ActivePlayer,
  ArenaMatch,
  ArenaMonsterSnapshot,
  BattleOutcomeEvent,
  KioskCap,
  Listing,
  MatchResolution,
  Monster,
  TreasuryConfig,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function parseOptionId(value: unknown): string | null {
  if (!value) return null;
  const rec = asRecord(value);
  if (typeof rec.id === "string") return rec.id;

  const vec = rec.vec as unknown[] | undefined;
  if (Array.isArray(vec) && vec.length > 0) {
    const first = vec[0] as Record<string, unknown>;
    if (typeof first === "string") return first;
    if (typeof first.id === "string") return first.id;
    if (asRecord(first.id).id) return String(asRecord(first.id).id);
  }
  return null;
}

function parseOptionMonsterId(value: unknown): string | null {
  if (!value) return null;
  const rec = asRecord(value);
  const vec = rec.vec as unknown[] | undefined;
  if (Array.isArray(vec) && vec.length > 0) {
    const first = asRecord(vec[0]);
    const fields = asRecord(first.fields);
    const id = asRecord(fields.id);
    if (typeof id.id === "string") return id.id;
  }
  return null;
}

function parseEmbeddedArenaMonster(value: unknown): ArenaMonsterSnapshot | null {
  if (!value) return null;
  const rec = asRecord(value);
  const vec = rec.vec as unknown[] | undefined;
  if (!Array.isArray(vec) || vec.length === 0) return null;

  const first = asRecord(vec[0]);
  const fields = asRecord(first.fields);
  const idFields = asRecord(fields.id);
  const objectId = String(idFields.id ?? "");
  if (!objectId) return null;

  return {
    objectId,
    name: String(fields.name ?? "Unknown"),
    stage: Number(fields.stage ?? 0),
    attack: Number(fields.attack ?? 0),
    defense: Number(fields.defense ?? 0),
    speed: Number(fields.speed ?? 0),
    wins: Number(fields.wins ?? 0),
    losses: Number(fields.losses ?? 0),
    xp: Number(fields.xp ?? 0),
    scars: Number(fields.scars ?? 0),
    broken_horns: Number(fields.broken_horns ?? 0),
    torn_wings: Number(fields.torn_wings ?? 0),
    created_at: String(fields.created_at ?? "0"),
  };
}

export function parseMonster(data: SuiObjectData, location: "wallet" | "kiosk", kioskId?: string, priceMist?: string): Monster | null {
  if (!data.content || data.content.dataType !== "moveObject") return null;
  const f = asRecord(data.content.fields);
  return {
    objectId: data.objectId,
    name: String(f.name ?? "Unknown"),
    seed: String(f.seed ?? "0"),
    stage: Number(f.stage ?? 0),
    attack: Number(f.attack ?? 0),
    defense: Number(f.defense ?? 0),
    speed: Number(f.speed ?? 0),
    wins: Number(f.wins ?? 0),
    losses: Number(f.losses ?? 0),
    xp: Number(f.xp ?? 0),
    scars: Number(f.scars ?? 0),
    broken_horns: Number(f.broken_horns ?? 0),
    torn_wings: Number(f.torn_wings ?? 0),
    created_at: String(f.created_at ?? "0"),
    last_breed: String(f.last_breed ?? "0"),
    parent1: parseOptionId(f.parent1),
    parent2: parseOptionId(f.parent2),
    location,
    kioskId,
    priceMist,
  };
}

export async function fetchTreasury(client: SuiClient): Promise<TreasuryConfig> {
  const obj = await client.getObject({ id: TREASURY_ID, options: { showContent: true } });
  const f = asRecord((obj.data?.content as any)?.fields);
  const fees = asRecord(f.fees);
  return {
    mint_enabled: Boolean(f.mint_enabled),
    mint_price_mist: String(f.mint_price_mist ?? "0"),
    fees: String(fees.value ?? "0"),
  };
}

export async function fetchOwnedMonsters(client: SuiClient, owner: string): Promise<Monster[]> {
  const res = await client.getOwnedObjects({
    owner,
    filter: { StructType: MONSTER_TYPE },
    options: { showContent: true, showDisplay: true, showType: true },
  });

  return res.data
    .map((o) => o.data)
    .filter((o): o is SuiObjectData => Boolean(o))
    .map((o) => parseMonster(o, "wallet"))
    .filter((m): m is Monster => Boolean(m));
}

function kioskNetwork(): Network {
  return Network.MAINNET;
}

export async function fetchOwnedKioskCaps(client: SuiClient, owner: string): Promise<KioskCap[]> {
  const kioskClient = new KioskClient({ client, network: kioskNetwork() });
  const owned = await kioskClient.getOwnedKiosks({ address: owner });
  return owned.kioskOwnerCaps.map((cap) => ({
    objectId: cap.objectId,
    kioskId: cap.kioskId,
    isPersonal: cap.isPersonal,
    digest: cap.digest,
    version: cap.version,
  }));
}

export async function fetchOwnedKioskMonsters(client: SuiClient, owner: string): Promise<Monster[]> {
  const kioskClient = new KioskClient({ client, network: kioskNetwork() });
  const owned = await kioskClient.getOwnedKiosks({ address: owner });

  const all: Monster[] = [];
  for (const cap of owned.kioskOwnerCaps) {
    const kiosk = await kioskClient.getKiosk({
      id: cap.kioskId,
      options: {
        withObjects: true,
        withListingPrices: true,
        objectOptions: { showContent: true, showType: true, showDisplay: true },
      },
    });

    for (const item of kiosk.items) {
      if (item.type !== MONSTER_TYPE || !item.data) continue;
      const monster = parseMonster(item.data, "kiosk", cap.kioskId, item.listing?.price);
      if (monster) all.push(monster);
    }
  }

  return all;
}

export async function fetchAdminCap(client: SuiClient, owner: string): Promise<string | null> {
  const res = await client.getOwnedObjects({
    owner,
    filter: { StructType: ADMIN_CAP_TYPE },
    options: { showType: true },
  });
  return res.data[0]?.data?.objectId ?? null;
}

export async function queryAllEvents(
  client: SuiClient,
  eventType: string,
  maxPages = 20,
  limit = 50
): Promise<PaginatedEvents["data"]> {
  let cursor: PaginatedEvents["nextCursor"] = null;
  const out: PaginatedEvents["data"] = [];

  for (let i = 0; i < maxPages; i += 1) {
    const page = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit,
    });
    out.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return out;
}

export async function queryModuleEvents(
  client: SuiClient,
  pkg: string,
  module: string,
  maxPages = 20,
  limit = 50
): Promise<PaginatedEvents["data"]> {
  let cursor: PaginatedEvents["nextCursor"] = null;
  const out: PaginatedEvents["data"] = [];

  for (let i = 0; i < maxPages; i += 1) {
    const page = await client.queryEvents({
      query: { MoveModule: { package: pkg, module } },
      cursor,
      limit,
    });
    out.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return out;
}

export async function fetchLatestMintPreviewId(client: SuiClient): Promise<string | null> {
  const events = await queryAllEvents(client, `${PACKAGE_ID}::${MODULE}::Minted`, 1, 20);
  const ids = events.map((e) => String(asRecord(e.parsedJson).monster_id ?? "")).filter(Boolean);
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

export async function fetchArenaMatch(client: SuiClient, matchId: string): Promise<ArenaMatch | null> {
  const obj = await client.getObject({ id: matchId, options: { showContent: true } });
  const c = obj.data?.content;
  if (!c || c.dataType !== "moveObject") return null;
  if (c.type !== ARENA_MATCH_TYPE) return null;

  const f = asRecord(c.fields);
  return {
    objectId: obj.data!.objectId,
    player_a: String(f.player_a ?? ""),
    player_b: String(f.player_b ?? ""),
    status: Number(f.status ?? 0) as 0 | 1 | 2 | 3,
    created_at: String(f.created_at ?? "0"),
    mon_a: parseOptionMonsterId(f.mon_a),
    mon_b: parseOptionMonsterId(f.mon_b),
    stake_a: String(asRecord(f.stake_a).value ?? "0"),
    stake_b: String(asRecord(f.stake_b).value ?? "0"),
    monster_a_data: parseEmbeddedArenaMonster(f.mon_a),
    monster_b_data: parseEmbeddedArenaMonster(f.mon_b),
  };
}

export async function fetchAllArenaMatches(client: SuiClient): Promise<ArenaMatch[]> {
  const events = await queryAllEvents(client, `${PACKAGE_ID}::${MODULE}::MatchCreated`);
  const ids = [...new Set(
    events
      .map((event) => String(asRecord(event.parsedJson).match_id ?? ""))
      .filter(Boolean)
  )];

  if (ids.length === 0) return [];

  const matches = await Promise.all(
    ids.map(async (id) => {
      try {
        return await fetchArenaMatch(client, id);
      } catch {
        return null;
      }
    })
  );

  return matches
    .filter((match): match is ArenaMatch => Boolean(match))
    .sort((a, b) => Number(b.created_at) - Number(a.created_at));
}

export async function fetchRecentMatches(client: SuiClient): Promise<ArenaMatch[]> {
  const matches = await fetchAllArenaMatches(client);
  return matches.slice(0, 30);
}

export async function fetchActivePlayers(client: SuiClient): Promise<ActivePlayer[]> {
  const activity: Record<string, ActivePlayer> = {};
  for (const eventType of ACTIVE_PLAYER_EVENT_TYPES) {
    const events = await queryAllEvents(client, eventType, 2, 50);
    for (const event of events) {
      const parsed = asRecord(event.parsedJson);
      const address = String(parsed.player ?? parsed.player_a ?? parsed.player_b ?? "");
      if (!address) continue;
      const ts = Number(event.timestampMs ?? 0);
      const existing = activity[address];
      if (!existing || existing.lastActivityMs < ts) {
        activity[address] = {
          address,
          lastActivityMs: ts,
          source: eventType.endsWith("MatchCreated") ? "match_created" : "deposit",
        };
      }
    }
  }
  return Object.values(activity).sort((a, b) => b.lastActivityMs - a.lastActivityMs);
}

export async function fetchBattleOutcomes(client: SuiClient): Promise<BattleOutcomeEvent[]> {
  const events = await queryAllEvents(client, `${PACKAGE_ID}::${MODULE}::BattleOutcome`, 10, 50);
  return events.map((e) => ({
    ...(asRecord(e.parsedJson) as any),
    timestampMs: String(e.timestampMs ?? "0"),
  }));
}

export async function fetchLeaderboard(client: SuiClient) {
  const outcomes = await fetchBattleOutcomes(client);
  const byMonster = new Map<string, { wins: number; xp: number }>();

  for (const outcome of outcomes) {
    const current = byMonster.get(outcome.winner_id) ?? { wins: 0, xp: 0 };
    current.wins = Math.max(current.wins, Number(outcome.winner_wins ?? 0));
    current.xp = Math.max(current.xp, Number(outcome.winner_xp ?? 0));
    byMonster.set(outcome.winner_id, current);
  }

  const topIds = [...byMonster.entries()]
    .sort((a, b) => {
      if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
      return b[1].xp - a[1].xp;
    })
    .slice(0, 20)
    .map(([id]) => id);

  if (topIds.length === 0) return [] as Monster[];
  const objects = await client.multiGetObjects({
    ids: topIds,
    options: { showContent: true, showDisplay: true, showType: true },
  });

  return objects
    .map((obj) => obj.data)
    .filter((obj): obj is SuiObjectData => Boolean(obj))
    .map((obj) => parseMonster(obj, "wallet"))
    .filter((m): m is Monster => Boolean(m));
}

export async function fetchMatchResolution(
  client: SuiClient,
  matchId: string
): Promise<MatchResolution | null> {
  const finishedEvents = await queryAllEvents(client, `${PACKAGE_ID}::${MODULE}::MatchFinished`, 8, 50);
  const found = finishedEvents.find(
    (evt) => String(asRecord(evt.parsedJson).match_id ?? "") === matchId
  );
  if (!found) return null;

  const parsed = asRecord(found.parsedJson);
  const resolution: MatchResolution = {
    matchId: String(parsed.match_id ?? ""),
    winner: String(parsed.winner ?? ""),
    winnerMonsterId: String(parsed.winner_monster_id ?? ""),
    loserMonsterId: String(parsed.loser_monster_id ?? ""),
    totalPayoutMist: String(parsed.total_payout_mist ?? "0"),
    feeMist: String(parsed.fee_mist ?? "0"),
    txDigest: found.id.txDigest,
    timestampMs: String(found.timestampMs ?? "0"),
  };

  try {
    const block = await client.getTransactionBlock({
      digest: found.id.txDigest,
      options: { showEvents: true },
    });
    const battleEvent = block.events?.find(
      (evt) => evt.type === `${PACKAGE_ID}::${MODULE}::BattleOutcome`
    );
    if (battleEvent?.parsedJson) {
      resolution.battleOutcome = {
        ...(asRecord(battleEvent.parsedJson) as BattleOutcomeEvent),
        timestampMs: String(found.timestampMs ?? "0"),
      };
    }
  } catch {
    // Best-effort enrichment; core match result data already present from MatchFinished.
  }

  return resolution;
}

function parseListing(parsed: Record<string, unknown>, txDigest: string): Listing | null {
  const itemId = String(parsed.id ?? parsed.item_id ?? parsed.itemId ?? "");
  const kioskId = String(parsed.kiosk ?? parsed.kiosk_id ?? parsed.kioskId ?? "");
  const priceMist = String(parsed.price ?? parsed.price_mist ?? parsed.amount ?? "");
  if (!itemId || !kioskId) return null;
  return { itemId, kioskId, priceMist: priceMist || "0", txDigest };
}

export async function fetchActiveListings(client: SuiClient): Promise<Listing[]> {
  const listedType = `0x2::kiosk::ItemListed<${MONSTER_TYPE}>`;
  const delistedType = `0x2::kiosk::ItemDelisted<${MONSTER_TYPE}>`;
  const purchasedType = `0x2::kiosk::ItemPurchased<${MONSTER_TYPE}>`;

  const events = await queryModuleEvents(client, "0x2", "kiosk", 20, 50);
  const targetEvents = events.filter(
    (evt) => evt.type === listedType || evt.type === delistedType || evt.type === purchasedType
  );

  const state = new Map<string, Listing | null>();
  for (const evt of targetEvents) {
    const parsed = asRecord(evt.parsedJson);
    const itemId = String(parsed.id ?? parsed.item_id ?? parsed.itemId ?? "");
    const kioskId = String(parsed.kiosk ?? parsed.kiosk_id ?? parsed.kioskId ?? "");
    if (!itemId || !kioskId) continue;
    const key = `${kioskId}:${itemId}`;
    if (state.has(key)) continue;

    if (evt.type === listedType) {
      state.set(key, parseListing(parsed, evt.id.txDigest));
    } else {
      state.set(key, null);
    }
  }

  return [...state.values()].filter((listing): listing is Listing => Boolean(listing));
}

export async function fetchListedMonsters(client: SuiClient): Promise<Monster[]> {
  const listings = await fetchActiveListings(client);
  if (listings.length === 0) return [];

  const objectIds = listings.map((l) => l.itemId);
  const objects = await client.multiGetObjects({
    ids: objectIds,
    options: { showContent: true, showDisplay: true, showType: true },
  });

  const byId = new Map(listings.map((l) => [l.itemId, l]));
  return objects
    .map((obj) => obj.data)
    .filter((obj): obj is SuiObjectData => Boolean(obj))
    .map((obj) => {
      const listing = byId.get(obj.objectId);
      return parseMonster(obj, "kiosk", listing?.kioskId, listing?.priceMist);
    })
    .filter((m): m is Monster => Boolean(m));
}
