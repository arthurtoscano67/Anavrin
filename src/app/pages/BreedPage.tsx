import { useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

import { MonsterImage } from "../components/MonsterImage";
import { PageShell } from "../components/PageShell";
import { Spinner } from "../components/Spinner";
import { StatBar } from "../components/StatBar";
import { CLOCK_ID, MODULE, MONSTER_TYPE, PACKAGE_ID } from "../lib/constants";
import { short } from "../lib/format";
import type { Monster } from "../lib/types";
import { parseMonster } from "../lib/sui";
import { useAnavrinData } from "../hooks/useAnavrinData";
import { useTxExecutor } from "../hooks/useTxExecutor";

export function BreedPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { adults, walletMonsters } = useAnavrinData();
  const { executeAndFetchBlock } = useTxExecutor();

  const [parentA, setParentA] = useState("");
  const [parentB, setParentB] = useState("");
  const [pending, setPending] = useState(false);
  const [child, setChild] = useState<Monster | null>(null);

  const parentAMonster = useMemo(
    () => adults.find((m) => m.objectId === parentA) ?? null,
    [adults, parentA]
  );
  const parentBMonster = useMemo(
    () => adults.find((m) => m.objectId === parentB) ?? null,
    [adults, parentB]
  );

  const preview = useMemo(() => {
    if (!parentAMonster || !parentBMonster) return null;
    return {
      attack: Math.floor((parentAMonster.attack + parentBMonster.attack) / 2),
      defense: Math.floor((parentAMonster.defense + parentBMonster.defense) / 2),
      speed: Math.floor((parentAMonster.speed + parentBMonster.speed) / 2),
    };
  }, [parentAMonster, parentBMonster]);

  const onBreed = async () => {
    if (!parentA || !parentB || parentA === parentB) return;

    setPending(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::breed`,
        arguments: [tx.object(parentA), tx.object(parentB), tx.object(CLOCK_ID)],
      });

      const { block } = await executeAndFetchBlock(tx, "Breeding complete");
      const createdMonster = block.objectChanges?.find(
        (c) => c.type === "created" && c.objectType === MONSTER_TYPE
      );

      if (createdMonster && "objectId" in createdMonster) {
        const obj = await client.getObject({
          id: createdMonster.objectId,
          options: { showContent: true, showDisplay: true, showType: true },
        });
        const parsed = obj.data ? parseMonster(obj.data, "wallet") : null;
        if (parsed) setChild(parsed);
      }

      await walletMonsters.refetch();
    } finally {
      setPending(false);
    }
  };

  return (
    <PageShell
      title="Breed"
      subtitle="Combine two Adult legends (stage 2+) to mint a child with inherited stats and on-chain lineage."
    >
      {!account && (
        <div className="glass-card p-4 text-sm text-gray-300">Connect wallet to breed monsters.</div>
      )}

      {account && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card space-y-3 p-4">
              <h2 className="text-lg font-bold">Select Parents</h2>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Parent A</label>
                <select className="input" value={parentA} onChange={(e) => setParentA(e.target.value)}>
                  <option value="">Choose Adult monster</option>
                  {adults.map((m) => (
                    <option value={m.objectId} key={m.objectId}>
                      {m.name} ({short(m.objectId)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Parent B</label>
                <select className="input" value={parentB} onChange={(e) => setParentB(e.target.value)}>
                  <option value="">Choose Adult monster</option>
                  {adults
                    .filter((m) => m.objectId !== parentA)
                    .map((m) => (
                      <option value={m.objectId} key={m.objectId}>
                        {m.name} ({short(m.objectId)})
                      </option>
                    ))}
                </select>
              </div>

              <button
                className="btn-primary w-full"
                onClick={onBreed}
                disabled={!parentA || !parentB || parentA === parentB || pending}
              >
                {pending ? <span className="inline-flex items-center gap-2"><Spinner /> Breeding...</span> : "Breed New Child"}
              </button>

              {adults.length < 2 && (
                <p className="text-xs text-gray-400">
                  You need at least two Adult monsters (stage 2+) in your wallet.
                </p>
              )}
            </div>

            <div className="glass-card space-y-3 p-4">
              <h2 className="text-lg font-bold">Child Preview</h2>
              {!preview && (
                <div className="rounded-xl border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
                  Select two parents to preview inherited attack/defense/speed averages.
                </div>
              )}

              {preview && (
                <div className="space-y-3">
                  <StatBar label="ATK" value={preview.attack} color="bg-red-500" />
                  <StatBar label="DEF" value={preview.defense} color="bg-blue-500" />
                  <StatBar label="SPD" value={preview.speed} color="bg-green-500" />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card space-y-3 p-4">
              <h3 className="font-semibold">Parent A</h3>
              {parentAMonster ? (
                <>
                  <MonsterImage objectId={parentAMonster.objectId} className="aspect-square" />
                  <div className="text-sm">
                    <div className="font-semibold">{parentAMonster.name}</div>
                    <div className="text-xs text-gray-400">{short(parentAMonster.objectId)}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400">Not selected</div>
              )}
            </div>

            <div className="glass-card space-y-3 p-4">
              <h3 className="font-semibold">Parent B</h3>
              {parentBMonster ? (
                <>
                  <MonsterImage objectId={parentBMonster.objectId} className="aspect-square" />
                  <div className="text-sm">
                    <div className="font-semibold">{parentBMonster.name}</div>
                    <div className="text-xs text-gray-400">{short(parentBMonster.objectId)}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400">Not selected</div>
              )}
            </div>
          </div>

          {child && (
            <div className="glass-card space-y-4 p-4">
              <h3 className="text-lg font-bold text-cyan">Child Monster Minted</h3>
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <MonsterImage objectId={child.objectId} className="aspect-square max-w-[220px]" />
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs text-gray-400">Name</div>
                    <div className="font-semibold">{child.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Child ID</div>
                    <div className="font-mono">{child.objectId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Lineage</div>
                    <div className="font-mono text-xs">Parent 1: {child.parent1 ?? "-"}</div>
                    <div className="font-mono text-xs">Parent 2: {child.parent2 ?? "-"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
