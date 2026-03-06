import { LoadingGrid } from '../../components/LoadingGrid';
import type { Monster } from '../../lib/types';
import type { BattleRoomViewModel } from '../battle-engine/battleEngine';
import { LegendPickerTile } from './LegendPickerTile';

const QUICK_STAKE_OPTIONS = ['0', '0.05', '0.10', '0.25', '0.50'];

type ArenaSetupPanelProps = {
  monsters: Monster[];
  isLoading: boolean;
  selectedMonsterId: string;
  selectedMonster: Monster | null;
  selectedStake: string;
  selectedStakeLabel: string;
  opponent: string;
  pending: string | null;
  recoveringMatch: boolean;
  canOpenRoom: boolean;
  room: BattleRoomViewModel;
  onPickMonster: (monsterId: string) => void;
  onPickStake: (stake: string) => void;
  onInviteFriend: () => void;
  onCreateRoom: () => void;
  onCreateOpenMatch: () => void;
  onPractice: () => void;
};

export function ArenaSetupPanel({
  monsters,
  isLoading,
  selectedMonsterId,
  selectedMonster,
  selectedStake,
  selectedStakeLabel,
  opponent,
  pending,
  recoveringMatch,
  canOpenRoom,
  room,
  onPickMonster,
  onPickStake,
  onInviteFriend,
  onCreateRoom,
  onCreateOpenMatch,
  onPractice,
}: ArenaSetupPanelProps) {
  const controlsLocked = pending !== null || recoveringMatch || room.userHasDeposited;

  return (
    <div className="glass-card overflow-hidden border-purple/35 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.28),transparent_42%),linear-gradient(135deg,rgba(17,24,39,0.92),rgba(11,18,32,0.96))] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan/75">Arena Setup</div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Invite. Ready up. Battle.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">{room.heroMessage}</p>
        </div>
        <div className="rounded-full border border-cyan/40 bg-cyan/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan">
          {room.statusText}
        </div>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        {room.coachSteps.map((step) => (
          <div
            key={step.id}
            className={`min-w-[140px] rounded-full border px-4 py-3 text-sm font-bold transition ${
              step.current
                ? 'border-cyan/50 bg-cyan/20 text-cyan shadow-[0_0_28px_rgba(6,182,212,0.14)]'
                : step.done
                  ? 'border-green-400/45 bg-green-500/15 text-green-100'
                  : 'border-white/10 bg-black/20 text-gray-200'
            }`}
          >
            <span className="mr-2 text-lg">{step.icon}</span>
            {step.title}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan/80">1. Tap your legend</div>
              <div className="mt-1 text-2xl font-black text-white">Pick a monster card</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white">
              {selectedMonster ? `${selectedMonster.name} • ${selectedStakeLabel} SUI` : 'No legend yet'}
            </div>
          </div>

          {isLoading ? (
            <div className="mt-4">
              <LoadingGrid count={2} />
            </div>
          ) : monsters.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-gray-300">
              Mint a legend first, then come back and tap it here.
            </div>
          ) : (
            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-2">
              {monsters.map((monster) => (
                <LegendPickerTile
                  key={monster.objectId}
                  monster={monster}
                  active={monster.objectId === selectedMonsterId}
                  locked={controlsLocked}
                  onSelect={() => onPickMonster(monster.objectId)}
                />
              ))}
            </div>
          )}

          <div className="mt-5">
            <div className="text-[11px] font-black uppercase tracking-[0.26em] text-orange-200">2. Tap your wager</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_STAKE_OPTIONS.map((stake) => (
                <button
                  key={stake}
                  type="button"
                  className={`rounded-full border px-4 py-3 text-sm font-black transition ${
                    selectedStake === stake
                      ? 'border-amber-300 bg-amber-400 text-slate-950'
                      : 'border-white/10 bg-white/5 text-white hover:border-amber-300/60 hover:bg-amber-400/15'
                  }`}
                  onClick={() => onPickStake(stake)}
                  disabled={controlsLocked}
                >
                  {stake} SUI
                </button>
              ))}
            </div>
            <div className="mt-3 max-w-[180px]">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Custom</label>
              <input
                className="input min-h-12"
                placeholder="0.00"
                value={selectedStake}
                onChange={(e) => onPickStake(e.target.value)}
                disabled={controlsLocked}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <button
            type="button"
            className="min-h-[84px] rounded-[28px] border border-green-300/50 bg-gradient-to-br from-green-500 to-emerald-400 p-5 text-left text-slate-950 shadow-[0_18px_40px_rgba(34,197,94,0.28)] transition hover:scale-[1.01]"
            onClick={onInviteFriend}
          >
            <div className="text-3xl">👥</div>
            <div className="mt-3 text-2xl font-black">{opponent.trim() ? 'Change Friend' : 'Invite Friend'}</div>
            <div className="mt-1 text-sm font-semibold">{opponent.trim() ? opponent : 'Tap a trainer card'}</div>
          </button>

          <button
            type="button"
            className="min-h-[84px] rounded-[28px] border border-cyan/50 bg-gradient-to-br from-cyan/40 to-sky-500/40 p-5 text-left text-white shadow-[0_18px_40px_rgba(6,182,212,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCreateRoom}
            disabled={!canOpenRoom || controlsLocked}
          >
            <div className="text-3xl">🏟️</div>
            <div className="mt-3 text-2xl font-black">{opponent.trim() ? 'Make Room!' : 'Pick Friend First'}</div>
            <div className="mt-1 text-sm font-semibold">{pending === 'create' ? 'Opening on-chain room...' : room.currentStep.help}</div>
          </button>

          <button
            type="button"
            className="min-h-[84px] rounded-[28px] border border-blue-300/40 bg-gradient-to-br from-blue-500/35 to-indigo-500/35 p-5 text-left text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCreateOpenMatch}
            disabled={controlsLocked || !selectedMonsterId}
          >
            <div className="text-3xl">🌐</div>
            <div className="mt-3 text-2xl font-black">Post Open Match</div>
            <div className="mt-1 text-sm font-semibold">Let anyone online jump in.</div>
          </button>

          <button
            type="button"
            className="min-h-[84px] rounded-[28px] border border-white/10 bg-white/5 p-5 text-left text-white/85 transition hover:border-white/20 hover:bg-white/10"
            onClick={onPractice}
          >
            <div className="text-3xl">🪞</div>
            <div className="mt-3 text-2xl font-black">Practice Soon</div>
            <div className="mt-1 text-sm font-semibold">Needs a contract patch for self-vs-self.</div>
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-cyan/35 bg-cyan/10 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan/80">Next tap</div>
          <div className="mt-3 flex items-start gap-3">
            <div className="text-3xl">{room.currentStep.icon}</div>
            <div className="min-w-0">
              <div className="text-xl font-black text-white">{room.currentStep.title}</div>
              <p className="mt-1 text-sm leading-6 text-white/90">{room.yourNextAction}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-purple/35 bg-purple/10 p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-purple-100">Other side</div>
          <div className="mt-3 text-xl font-black text-white">{opponent.trim() || 'Nobody yet'}</div>
          <p className="mt-2 text-sm leading-6 text-white/90">{room.opponentNextAction}</p>
        </div>
      </div>
    </div>
  );
}
