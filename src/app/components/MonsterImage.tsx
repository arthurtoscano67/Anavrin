import { useEffect, useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

import { parseMonster } from "../lib/sui";
import { monsterToProceduralInput, normalizeProceduralMonster, renderMonsterDataUri, type ProceduralMonsterInput } from "../lib/monsterRenderer";

type MonsterImageProps = {
  objectId: string;
  className?: string;
  monster?: ProceduralMonsterInput | null;
};

function hasSeed(value?: ProceduralMonsterInput | null): boolean {
  return Boolean(value && typeof value.seed === "string" && typeof value.stage === "number");
}

function toVisualInput(
  objectId: string,
  monster?: ProceduralMonsterInput | null
): ProceduralMonsterInput {
  if (!monster) {
    return {
      objectId,
      stage: 0,
      name: "Anavrin Legend",
    };
  }

  if (hasSeed(monster)) {
    return {
      objectId,
      seed: monster.seed,
      name: monster.name,
      stage: monster.stage,
      attack: monster.attack,
      defense: monster.defense,
      speed: monster.speed,
      wins: monster.wins,
      losses: monster.losses,
      xp: monster.xp,
      scars: monster.scars,
      broken_horns: monster.broken_horns,
      torn_wings: monster.torn_wings,
    };
  }

  return {
    objectId,
    name: monster.name,
    stage: monster.stage,
    attack: monster.attack,
    defense: monster.defense,
    speed: monster.speed,
    wins: monster.wins,
    losses: monster.losses,
    xp: monster.xp,
    scars: monster.scars,
    broken_horns: monster.broken_horns,
    torn_wings: monster.torn_wings,
  };
}

export function MonsterImage({ objectId, className = "", monster = null }: MonsterImageProps) {
  const client = useSuiClient();
  const [resolved, setResolved] = useState<ProceduralMonsterInput>(() =>
    normalizeProceduralMonster(toVisualInput(objectId, monster))
  );

  const objectSeed = hasSeed(monster) ? monster?.seed : undefined;
  const objectStage = typeof monster?.stage === "number" ? monster.stage : undefined;
  const objectName = typeof monster?.name === "string" ? monster.name : undefined;

  useEffect(() => {
    let cancelled = false;

    if (monster) {
      setResolved(normalizeProceduralMonster(toVisualInput(objectId, monster)));
      if (hasSeed(monster)) {
        return () => {
          cancelled = true;
        };
      }
    } else {
      setResolved((current) =>
        normalizeProceduralMonster({
          objectId,
          seed: current.seed,
          stage: objectStage ?? current.stage ?? 0,
          name: objectName ?? current.name ?? "Anavrin Legend",
          attack: current.attack,
          defense: current.defense,
          speed: current.speed,
          wins: current.wins,
          losses: current.losses,
          xp: current.xp,
          scars: current.scars,
          broken_horns: current.broken_horns,
          torn_wings: current.torn_wings,
        })
      );
    }

    void client
      .getObject({
        id: objectId,
        options: { showContent: true, showType: true, showDisplay: true },
      })
      .then((response) => {
        if (cancelled || !response.data) return;
        const parsed = parseMonster(response.data, "wallet");
        if (!parsed) return;
        setResolved(monsterToProceduralInput(parsed));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [client, monster, objectId, objectName, objectSeed, objectStage]);

  const src = useMemo(() => renderMonsterDataUri(resolved), [resolved]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black/30 ${className}`}>
      <img
        src={src}
        alt={`${resolved.name} ${objectId}`}
        className="h-full w-full object-contain p-3 drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)]"
        loading="lazy"
      />
    </div>
  );
}
