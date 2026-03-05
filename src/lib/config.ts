export const APP_NAME = "Anavrin Monsters";
export const APP_DESCRIPTION =
  "Monster NFT battle arena on Sui with wallet + kiosk inventory, breeding, and live PvP coordination.";

export const SUI_NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as "mainnet" | "testnet" | "devnet") ||
  "mainnet";

export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ||
  "0xc16803b7fc3661faf22d0d46ac40b93cad4c05e5813689e9638ea67d18222eae";

export const TREASURY_ID =
  process.env.NEXT_PUBLIC_TREASURY_ID ||
  "0xc0a94c8a7cfe5bd28288ffce3d2d1d696ab9637bd1667f4c1d95dac55f452b2a";

export const DISPLAY_ID =
  process.env.NEXT_PUBLIC_DISPLAY_ID ||
  "0xd66637cb70bce048659edda2f0c9790a8d297a95f5138926a54bba270695f0f8";

export const CLOCK_ID = "0x6";
export const SUI_DECIMALS = 1_000_000_000;

export const MONSTER_TYPE = `${PACKAGE_ID}::monster::Monster`;
export const ADMIN_CAP_TYPE = `${PACKAGE_ID}::monster::AdminCap`;

export const STAGE_META = [
  { id: 0, name: "Egg", emoji: "🥚" },
  { id: 1, name: "Baby", emoji: "🌱" },
  { id: 2, name: "Adult", emoji: "⚔️" },
  { id: 3, name: "Legend", emoji: "✨" },
] as const;

export const EQUIPMENT_SLOTS = [
  "hat",
  "shirt",
  "pants",
  "shoes",
  "armor",
  "suit",
] as const;

export const RENDERER_BASE =
  process.env.NEXT_PUBLIC_RENDERER_BASE ||
  "https://heart-beat-production.up.railway.app";
