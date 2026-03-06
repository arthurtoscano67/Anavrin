import { statusLabel, toSui } from "../lib/format";
import type { ArenaMatch } from "../lib/types";
import { ArenaMonsterPanel } from "./ArenaMonsterPanel";

export function BattleArena({
  match,
  playerALabel,
  playerBLabel,
  onRefresh,
  refreshing = false,
  isResolving = false,
  winnerSide = null,
}: {
  match: ArenaMatch | null;
  playerALabel: string;
  playerBLabel: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  isResolving?: boolean;
  winnerSide?: "left" | "right" | null;
}) {
  if (!match) {
    return (
      <div className="arena-stage grid min-h-[420px] place-items-center rounded-[32px] border border-borderSoft p-5 text-center text-sm text-gray-300">
        Load a battle to see both legends face off in the colosseum.
      </div>
    );
  }

  const totalStake = Number(match.stake_a || "0") + Number(match.stake_b || "0");
  const monsterAName = match.monster_a_data?.name ?? "Awaiting Legend";
  const monsterBName = match.monster_b_data?.name ?? "Awaiting Legend";

  return (
    <section className="arena-stage overflow-hidden rounded-[32px] border border-purple/30 p-4 md:p-6">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.26em] text-cyan/80">Battle Arena</div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
            {monsterAName} vs {monsterBName}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Battle ID {match.objectId.slice(0, 10)}...</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Stake {toSui(totalStake)} SUI</span>
            <span className="rounded-full border border-purple/35 bg-purple/15 px-3 py-1">{statusLabel(match.status)}</span>
          </div>
        </div>

        {onRefresh ? (
          <button className="btn-ghost text-xs" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Syncing..." : "Refresh"}
          </button>
        ) : null}
      </div>

      <div className="arena-lights" />
      <div className="arena-dust" />
      {isResolving ? <div className="arena-impact-flash" /> : null}

      <div className="relative z-10 mt-6 grid gap-4 md:grid-cols-[1fr_110px_1fr] md:items-center">
        <div className={`${isResolving ? "arena-attack-left" : ""} ${winnerSide === "left" ? "arena-winner" : ""}`}>
          <ArenaMonsterPanel
            monster={match.monster_a_data}
            playerLabel={playerALabel}
            side="left"
            isReady={Boolean(match.mon_a)}
            stakeLabel={toSui(match.stake_a)}
          />
        </div>

        <div className="grid place-items-center">
          <div className="arena-versus-ring">
            <span>VS</span>
          </div>
        </div>

        <div className={`${isResolving ? "arena-recoil-right" : ""} ${winnerSide === "right" ? "arena-winner" : ""}`}>
          <ArenaMonsterPanel
            monster={match.monster_b_data}
            playerLabel={playerBLabel}
            side="right"
            isReady={Boolean(match.mon_b)}
            stakeLabel={toSui(match.stake_b)}
          />
        </div>
      </div>
    </section>
  );
}
