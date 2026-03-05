export const PACKAGE_ID = "0x51abc7016876cd23efcd5a5240bc03ef0e3ed4538e0d87a029944d45cb3e4b81";
export const TREASURY_ID = "0x414bd328952f9ddfde568e0a256476a0e2e148b21b606892f07ea3dd4360baeb";
export const ADMIN_CAP_ID = "0x746ab4a8c595b0ef3008fe062af780aa36eeac1ff6543603c5f248324a229776";
export const DISPLAY_ID = "0xda8656ee556049f5c96579340240a7da76654d02daf4b49808d00c6432dd72d8";
export const CLOCK_ID = "0x6";
export const MODULE = "monster";
export const RENDERER = "https://heart-beat-production.up.railway.app";
export const SUI_NETWORK = "mainnet";
export const SUI_DECIMALS = 1_000_000_000;

export const MONSTER_TYPE = `${PACKAGE_ID}::${MODULE}::Monster`;
export const TREASURY_TYPE = `${PACKAGE_ID}::${MODULE}::Treasury`;
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::${MODULE}::AdminCap`;
export const ARENA_MATCH_TYPE = `${PACKAGE_ID}::${MODULE}::ArenaMatch`;

export const STAGE_META: Record<number, { label: string; color: string; emoji: string }> = {
  0: { label: "Egg", color: "bg-stageEgg/20 text-stageEgg border-stageEgg/40", emoji: "🥚" },
  1: { label: "Baby", color: "bg-stageBaby/20 text-stageBaby border-stageBaby/40", emoji: "🌱" },
  2: { label: "Adult", color: "bg-stageAdult/20 text-stageAdult border-stageAdult/40", emoji: "⚔️" },
  3: { label: "Legend", color: "bg-stageLegend/20 text-stageLegend border-stageLegend/40", emoji: "👑" },
};

export const ROUTES = [
  { path: "/", label: "Mint" },
  { path: "/legends", label: "My Legends" },
  { path: "/arena", label: "Arena" },
  { path: "/breed", label: "Breed" },
  { path: "/market", label: "Marketplace" },
  { path: "/leaderboard", label: "Leaderboard" },
  { path: "/admin", label: "Admin" },
] as const;
