import { toast } from 'sonner';

import { Spinner } from '../../components/Spinner';
import { short, toSui } from '../../lib/format';
import type { ArenaMatch, MatchResolution } from '../../lib/types';
import type { BattleRoomViewModel } from '../battle-engine/battleEngine';
import { ArenaRenderer } from '../arena-ui/ArenaRenderer';

type BattleRoomPanelProps = {
  accountAddress?: string | null;
  currentMatchId: string;
  match: ArenaMatch | null;
  resolution: MatchResolution | null;
  room: BattleRoomViewModel;
  pending: string | null;
  recoveringMatch: boolean;
  inviteUrl: string;
  onRefresh: () => void;
  onReset: () => void;
  onDepositLegend: () => void;
  onStartBattle: () => void;
  onWithdraw: () => void;
};

export function BattleRoomPanel({
  accountAddress,
  currentMatchId,
  match,
  resolution,
  room,
  pending,
  recoveringMatch,
  inviteUrl,
  onRefresh,
  onReset,
  onDepositLegend,
  onStartBattle,
  onWithdraw,
}: BattleRoomPanelProps) {
  const playerALabel = match
    ? `${short(match.player_a)}${accountAddress === match.player_a ? ' • You' : ''}`
    : 'Player A';
  const playerBLabel = match
    ? `${short(match.player_b)}${accountAddress === match.player_b ? ' • You' : ''}`
    : 'Player B';

  return (
    <div className="glass-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan/80">Battle Room</div>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Room Instance</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">Left legend, right legend, then smash battle.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inviteUrl ? (
            <button
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:border-cyan/40 hover:bg-cyan/10"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                toast.success('Invite link copied');
              }}
            >
              Copy Room Link
            </button>
          ) : null}
          <button
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:border-cyan/40 hover:bg-cyan/10"
            disabled={!currentMatchId || pending !== null || recoveringMatch}
            onClick={onRefresh}
          >
            {pending === 'load' ? 'Syncing...' : 'Refresh'}
          </button>
          <button
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:border-red-300/60 hover:bg-red-500/10"
            onClick={onReset}
            disabled={pending !== null || recoveringMatch}
          >
            Back To Lobby
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Room</div>
          <div className="mt-2 text-lg font-bold text-white">{room.statusText}</div>
          <div className="mt-1 text-xs text-gray-400">{currentMatchId ? `Match ${short(currentMatchId)}` : 'No room loaded yet'}</div>
        </div>
        <div className="rounded-[22px] border border-cyan/25 bg-cyan/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan/80">You</div>
          <div className="mt-2 text-lg font-bold text-white">{room.userHasDeposited ? 'READY!' : 'Pick + Send'}</div>
          <div className="mt-1 text-xs text-gray-300">{room.userHasDeposited ? 'Your legend and wager are locked in.' : 'Deposit to show Ready.'}</div>
        </div>
        <div className="rounded-[22px] border border-purple/25 bg-purple/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-purple-100">Opponent</div>
          <div className="mt-2 text-lg font-bold text-white">{room.opponentHasDeposited ? 'READY!' : 'Waiting...'}</div>
          <div className="mt-1 text-xs text-gray-300">{room.opponentHasDeposited ? 'Their legend is in the room.' : 'They still need to deposit.'}</div>
        </div>
      </div>

      {recoveringMatch ? (
        <div className="rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-8 text-center text-sm text-cyan">
          <span className="inline-flex items-center gap-2"><Spinner /> Syncing ArenaMatch from chain...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <ArenaRenderer
            match={match}
            playerALabel={playerALabel}
            playerBLabel={playerBLabel}
            onRefresh={currentMatchId ? onRefresh : undefined}
            refreshing={pending === 'load'}
            isResolving={pending === 'battle'}
            winnerSide={room.winnerSide}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              className="min-h-[84px] rounded-[28px] border border-green-300/55 bg-gradient-to-br from-green-500 to-emerald-400 px-4 text-lg font-black text-slate-950 shadow-[0_18px_40px_rgba(34,197,94,0.3)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onDepositLegend}
              disabled={!accountAddress || !currentMatchId || pending !== null || recoveringMatch || room.userHasDeposited}
            >
              {pending === 'join'
                ? <span className="inline-flex items-center gap-2"><Spinner /> Readying...</span>
                : room.userHasDeposited
                  ? 'READY!'
                  : 'Send Legend!'}
            </button>
            <button
              className={`min-h-[84px] rounded-[28px] border border-red-300/60 bg-gradient-to-br from-red-500 to-rose-500 px-4 text-lg font-black text-white shadow-[0_18px_40px_rgba(239,68,68,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 ${room.canStartBattle ? 'arena-battle-shake' : ''}`}
              onClick={onStartBattle}
              disabled={!room.canStartBattle || pending !== null || recoveringMatch}
            >
              {pending === 'battle' ? <span className="inline-flex items-center gap-2"><Spinner /> Resolving...</span> : 'Start Battle'}
            </button>
            <button
              className="min-h-[84px] rounded-[28px] border border-red-300/40 bg-red-500/10 px-4 text-lg font-black text-red-100 transition hover:border-red-300/60 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onWithdraw}
              disabled={!room.canWithdraw || pending !== null || recoveringMatch}
            >
              {pending === 'withdraw' ? <span className="inline-flex items-center gap-2"><Spinner /> Leaving...</span> : 'Withdraw & Leave'}
            </button>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm font-semibold text-gray-200">
            {room.bothDeposited
              ? 'Both legends are glowing. Anyone can press BATTLE.'
              : room.userHasDeposited
                ? 'You are ready. Wait for the other side, or leave if they disappear.'
                : 'Tap Send Legend! when you like your monster and wager.'}
          </div>
        </div>
      )}

      {resolution ? (
        <div className="rounded-[24px] border border-cyan/40 bg-cyan/10 p-4 text-sm">
          <div className="mb-2 text-xs uppercase tracking-wide text-cyan-200">Battle Result</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-xs text-gray-300">Winner</div>
              <div className="arena-win-pulse text-2xl font-black text-green-300">{short(resolution.winner)}</div>
              <div className="text-xs text-gray-400">Monster {short(resolution.winnerMonsterId)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-300">Loser Monster</div>
              <div className="font-semibold text-red-300">{short(resolution.loserMonsterId)}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-xs text-gray-400">Payout</div>
              <div className="font-semibold">{toSui(resolution.totalPayoutMist)} SUI</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Arena Fee</div>
              <div className="font-semibold">{toSui(resolution.feeMist)} SUI</div>
            </div>
            {resolution.battleOutcome ? (
              <div>
                <div className="text-xs text-gray-400">Winner XP</div>
                <div className="font-semibold text-cyan">{resolution.battleOutcome.winner_xp}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
