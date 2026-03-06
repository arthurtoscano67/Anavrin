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
      <div className="arena-stage overflow-hidden rounded-[32px] border border-borderSoft p-5">
        <div className="relative z-10 mx-auto flex min-h-[400px] max-w-3xl flex-col items-center justify-center text-center">
          <div className="rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan/80">
            Ready Room
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Invite a trainer and lock in your legend.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300 sm:text-base">
            The arena wakes up when both players accept, deposit their legends, and match the wager.
            Then either trainer can start the battle.
          </p>

          <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-3xl">1</div>
              <div className="mt-2 text-sm font-bold text-white">Invite</div>
              <div className="mt-1 text-xs text-gray-400">Tap a trainer in the lobby.</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-3xl">2</div>
              <div className="mt-2 text-sm font-bold text-white">Ready Up</div>
              <div className="mt-1 text-xs text-gray-400">Both trainers deposit legend + wager.</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <div className="text-3xl">3</div>
              <div className="mt-2 text-sm font-bold text-white">Battle</div>
              <div className="mt-1 text-xs text-gray-400">Either trainer can press Start Battle.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalStake = Number(match.stake_a || "0") + Number(match.stake_b || "0");
  const monsterAName = match.monster_a_data?.name ?? "Awaiting Legend";
  const monsterBName = match.monster_b_data?.name ?? "Awaiting Legend";
  const isReadyRoom = !match.mon_a || !match.mon_b;
  const headline = !match.mon_a && !match.mon_b
    ? "Ready Room Open"
    : !match.mon_b
      ? `${monsterAName} is ready`
      : !match.mon_a
        ? `${monsterBName} is ready`
        : `${monsterAName} vs ${monsterBName}`;
  const helperText = match.status === 2
    ? "Battle finished. Scroll down to see the winner and payout."
    : match.status === 3
      ? "This room was cancelled and all legends were returned."
      : isReadyRoom
        ? "Both trainers can watch the room update live. Deposit your legend and matching wager to show Ready."
        : "Both legends are ready. Anyone in the room can start the battle now.";

  return (
    <section className="arena-stage overflow-hidden rounded-[32px] border border-purple/30 p-4 md:p-6">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.26em] text-cyan/80">
            {isReadyRoom ? "Ready Room" : "Battle Arena"}
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
            {headline}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
            {helperText}
          </p>
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
