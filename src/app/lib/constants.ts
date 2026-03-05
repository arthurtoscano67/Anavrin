export const PACKAGE_ID = "0xc16803b7fc3661faf22d0d46ac40b93cad4c05e5813689e9638ea67d18222eae";
export const TREASURY_ID = "0xc0a94c8a7cfe5bd28288ffce3d2d1d696ab9637bd1667f4c1d95dac55f452b2a";
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
