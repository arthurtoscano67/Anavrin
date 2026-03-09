import { ANAVRIN_CONFIG } from "../config/anavrinConfig";
import type { ExperienceStage, WorldSpawn } from "../types";

const NYC_SPAWN_POINTS: WorldSpawn[] = [
  {
    district: "Chelsea",
    position: [0, 0.9, 18],
    heading: Math.PI,
  },
  {
    district: "SoHo",
    position: [-14, 0.9, 10],
    heading: Math.PI * 0.66,
  },
  {
    district: "Midtown",
    position: [16, 0.9, 12],
    heading: Math.PI * 1.2,
  },
  {
    district: "DUMBO",
    position: [10, 0.9, -14],
    heading: 0,
  },
];

function hashSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function resolveWorldSpawn(seed?: string | null): WorldSpawn {
  if (!seed) {
    return {
      district: ANAVRIN_CONFIG.world.mapName,
      position: [...ANAVRIN_CONFIG.world.spawnPoint],
      heading: ANAVRIN_CONFIG.world.spawnHeading,
    };
  }

  return NYC_SPAWN_POINTS[hashSeed(seed) % NYC_SPAWN_POINTS.length];
}

export function resolveExperienceStage(args: {
  hasConnection: boolean;
  hasIdentity: boolean;
  isMinting: boolean;
}): ExperienceStage {
  if (args.hasIdentity) return "spawned";
  if (args.isMinting) return "minting";
  if (args.hasConnection) return "creator";
  return "connect";
}
