import { toSui, short, statusLabel } from '../../lib/format';
import type { ArenaMatch, MatchResolution } from '../../lib/types';
import type { BattlePreview } from '../battle-engine/battleEngine';
import { ArenaMonsterPanel } from './ArenaMonsterPanel';

export function BattleArenaScreen({
  match,
  resolution,
  preview,
  frameIndex,
  animating,
  canAttack,
  pending,
  accountAddress,
  spectator,
  onAttack,
  onSpecial,
  onDefend,
  onEmote,
  onBackRoom,
  onBackLobby,
}: {
  match: ArenaMatch | null;
  resolution: MatchResolution | null;
  preview: BattlePreview | null;
  frameIndex: number;
  animating: boolean;
  canAttack: boolean;
  pending: string | null;
  accountAddress?: string;
  spectator: boolean;
  onAttack: () => void;
  onSpecial: () => void;
  onDefend: () => void;
  onEmote: () => void;
  onBackRoom: () => void;
  onBackLobby: () => void;
}) {
  if (!match) {
    return (
      <div className="glass-card space-y-4 p-6 text-center">
        <div className="text-3xl font-black text-white">No battle loaded.</div>
        <button className="btn-primary" onClick={onBackLobby}>Go To Lobby</button>
      </div>
    );
  }

  const currentFrame = preview?.frames[Math.min(frameIndex, Math.max(0, (preview?.frames.length ?? 1) - 1))];
  const totalStake = Number(match.stake_a || '0') + Number(match.stake_b || '0');
  const leftLabel = spectator
    ? 'Player A'
    : match.player_a === accountAddress
      ? 'Your Monster'
      : 'Enemy Monster';
  const rightLabel = spectator
    ? 'Player B'
    : match.player_b === accountAddress
      ? 'Your Monster'
      : 'Enemy Monster';
  const winnerSide = resolution
    ? resolution.winner === match.player_a
      ? 'left'
      : 'right'
    : currentFrame?.winnerSide;

  return (
    <div className="space-y-4">
      <section className="glass-card space-y-3 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan/80">Battle Arena</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {match.monster_a_data?.name ?? 'Legend A'} vs {match.monster_b_data?.name ?? 'Legend B'}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-gray-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Battle ID {short(match.objectId)}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Stake {toSui(totalStake)} SUI</span>
              <span className="rounded-full border border-purple/35 bg-purple/15 px-3 py-1">{statusLabel(match.status)}</span>
              {spectator ? <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-cyan">Spectator</span> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={onBackRoom}>Room</button>
            <button className="btn-ghost" onClick={onBackLobby}>Lobby</button>
          </div>
        </div>
      </section>

      <section className="arena-stage overflow-hidden rounded-[34px] border border-purple/25 p-4 sm:p-6">
        <div className="arena-lights" />
        <div className="arena-dust" />
        {animating && currentFrame?.flash ? <div className="arena-impact-flash" /> : null}

        <div className="relative z-10 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan/80">{currentFrame?.label ?? 'Battle stance'}</div>
        </div>

        <div className="relative z-10 mt-5 grid gap-4 lg:grid-cols-[1fr_120px_1fr] lg:items-center">
          <div className={animating && currentFrame?.actor === 'left' ? 'arena-attack-left' : winnerSide === 'left' ? 'arena-winner' : ''}>
            <ArenaMonsterPanel
              title={leftLabel}
              address={match.player_a}
              monster={match.monster_a_data}
              ready={Boolean(match.mon_a)}
              side="left"
              hpPercent={currentFrame?.leftHp ?? 100}
              stateLabel={winnerSide === 'left' ? 'Winner' : 'Ready'}
            />
          </div>

          <div className="grid place-items-center">
            <div className="arena-versus-ring"><span>⚡</span></div>
          </div>

          <div className={animating && currentFrame?.actor === 'right' ? 'arena-attack-left' : winnerSide === 'right' ? 'arena-winner' : ''}>
            <ArenaMonsterPanel
              title={rightLabel}
              address={match.player_b}
              monster={match.monster_b_data}
              ready={Boolean(match.mon_b)}
              side="right"
              hpPercent={currentFrame?.rightHp ?? 100}
              stateLabel={winnerSide === 'right' ? 'Winner' : 'Ready'}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          className={`min-h-[82px] rounded-[24px] text-xl font-black disabled:opacity-50 ${canAttack ? 'arena-battle-shake bg-gradient-to-r from-red-500 to-orange-400 text-white' : 'border border-borderSoft bg-black/20 text-gray-300'}`}
          onClick={onAttack}
          disabled={!canAttack || pending !== null}
        >
          ATTACK
        </button>
        <button
          className={`min-h-[82px] rounded-[24px] text-xl font-black disabled:opacity-50 ${canAttack ? 'bg-gradient-to-r from-fuchsia-500 to-pink-400 text-white' : 'border border-borderSoft bg-black/20 text-gray-300'}`}
          onClick={onSpecial}
          disabled={!canAttack || pending !== null}
        >
          SPECIAL
        </button>
        <button
          className="min-h-[82px] rounded-[24px] border border-cyan/40 bg-cyan/10 text-xl font-black text-cyan disabled:opacity-50"
          onClick={onDefend}
          disabled={pending !== null}
        >
          DEFEND
        </button>
        <button
          className="min-h-[82px] rounded-[24px] border border-white/10 bg-white/5 text-xl font-black text-white disabled:opacity-50"
          onClick={onEmote}
          disabled={pending !== null}
        >
          EMOTE
        </button>
      </section>

      {resolution ? (
        <section className="glass-card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Winner</div>
            <div className="mt-2 text-xl font-black text-green-200">{short(resolution.winner)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Winner Monster</div>
            <div className="mt-2 text-lg font-black text-white">{short(resolution.winnerMonsterId)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Loser Monster</div>
            <div className="mt-2 text-lg font-black text-white">{short(resolution.loserMonsterId)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Payout</div>
            <div className="mt-2 text-xl font-black text-yellow-100">{toSui(resolution.totalPayoutMist)} SUI</div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
