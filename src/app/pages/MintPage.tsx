import { useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

import { PageShell } from "../components/PageShell";
import { MonsterImage } from "../components/MonsterImage";
import { StageBadge } from "../components/StageBadge";
import { Spinner } from "../components/Spinner";
import { CLOCK_ID, MODULE, MONSTER_TYPE, PACKAGE_ID, TREASURY_ID } from "../lib/constants";
import { toSui } from "../lib/format";
import type { Monster } from "../lib/types";
import { parseMonster } from "../lib/sui";
import { useAnavrinData } from "../hooks/useAnavrinData";
import { useTxExecutor } from "../hooks/useTxExecutor";

export function MintPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { treasury, mintPreviewId, walletMonsters } = useAnavrinData();
  const { executeAndFetchBlock } = useTxExecutor();
  const [minted, setMinted] = useState<Monster | null>(null);
  const [pending, setPending] = useState(false);

  const previewId = useMemo(() => {
    return minted?.objectId || mintPreviewId.data || walletMonsters.data?.[0]?.objectId || "";
  }, [mintPreviewId.data, minted?.objectId, walletMonsters.data]);

  const onMint = async () => {
    if (!account) return;
    const priceMist = treasury.data?.mint_price_mist ?? "0";
    setPending(true);
    try {
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(priceMist)]);
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::mint`,
        arguments: [tx.object(TREASURY_ID), tx.object(CLOCK_ID), coin],
      });

      const { block } = await executeAndFetchBlock(tx, "Legend minted");
      const createdMonster = block.objectChanges?.find(
        (c) => c.type === "created" && c.objectType === MONSTER_TYPE
      );
      if (createdMonster && "objectId" in createdMonster) {
        const obj = await client.getObject({
          id: createdMonster.objectId,
          options: { showContent: true, showDisplay: true, showType: true },
        });
        const parsed = obj.data ? parseMonster(obj.data, "wallet") : null;
        if (parsed) setMinted(parsed);
      }
      walletMonsters.refetch();
    } finally {
      setPending(false);
    }
  };

  return (
    <PageShell
      title="Mint A Living Legend"
      subtitle="Mint directly on Sui mainnet. Stage evolves with time, and traits update on-chain via heartbeat/hatch/evolve."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass-card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">Live Animated Preview</div>
            {minted && <StageBadge stage={minted.stage} />}
          </div>
          {previewId ? (
            <MonsterImage objectId={previewId} className="aspect-square" />
          ) : (
            <div className="grid aspect-square place-items-center rounded-2xl border border-borderSoft bg-black/20 text-gray-500">No preview yet</div>
          )}
          <p className="text-xs text-gray-400">SVG loads first; PNG fallback is used automatically if needed.</p>
        </div>

        <div className="glass-card space-y-5 p-5">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-gray-400">Treasury Config</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Mint Price</span>
              <span className="text-xl font-bold text-cyan">{toSui(treasury.data?.mint_price_mist)} SUI</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Status</span>
              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${treasury.data?.mint_enabled ? "border-green-400/40 bg-green-500/15 text-green-300" : "border-red-400/40 bg-red-500/15 text-red-300"}`}>
                {treasury.data?.mint_enabled ? "Mint Enabled" : "Paused"}
              </span>
            </div>
          </div>

          {!account && (
            <div className="rounded-xl border border-purple/40 bg-purple/15 p-3 text-sm text-purple-100">
              Connect wallet to mint your first Anavrin Legend.
            </div>
          )}

          <button
            className="btn-primary w-full"
            disabled={!account || !treasury.data?.mint_enabled || pending || treasury.isLoading}
            onClick={onMint}
          >
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Minting...
              </span>
            ) : (
              `Mint for ${toSui(treasury.data?.mint_price_mist)} SUI`
            )}
          </button>

          {minted && (
            <div className="rounded-xl border border-cyan/40 bg-cyan/10 p-3 text-sm text-cyan-100">
              Mint success: <strong>{minted.name}</strong> ({minted.objectId})
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
