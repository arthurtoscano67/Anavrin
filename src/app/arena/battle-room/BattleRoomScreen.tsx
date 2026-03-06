import { StageBadge } from '../../components/StageBadge';
import { MonsterImage } from '../../components/MonsterImage';
import { short } from '../../lib/format';
import type { ArenaMatch, MatchResolution, Monster } from '../../lib/types';
import type { RoomNotice, RoomParticipant } from '../network/types';
import type { RoomModel } from '../battle-engine/battleEngine';
import { ArenaMonsterPanel } from '../arena-ui/ArenaMonsterPanel';

const STAKE_OPTIONS = ['0', '0.1', '0.25', '0.5', '1'];

type VisualMonster = Partial<Monster> & {
  objectId?: string;
  name?: string;
  stage?: number;
};

export function BattleRoomScreen({
  accountAddress,
  match,
  currentMatchId,
  resolution,
  roomParticipants,
  roomNotices,
  roomModel,
  selectedMonsterId,
  monsters,
  selectedStake,
  playerAMonster,
  playerBMonster,
  pending,
  onPickMonster,
  onPickStake,
  onDeposit,
  onWithdraw,
  onToggleReady,
  onOpenBattle,
  onBackLobby,
}: {
  accountAddress?: string;
  match: ArenaMatch | null;
  currentMatchId?: string;
  resolution: MatchResolution | null;
  roomParticipants: RoomParticipant[];
  roomNotices: RoomNotice[];
  roomModel: RoomModel;
  selectedMonsterId: string;
  monsters: Monster[];
  selectedStake: string;
  playerAMonster?: VisualMonster | null;
  playerBMonster?: VisualMonster | null;
  pending: string | null;
  onPickMonster: (monsterId: string) => void;
  onPickStake: (stake: string) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onToggleReady: () => void;
  onOpenBattle: () => void;
  onBackLobby: () => void;
}) {
  const playerA = match?.player_a;
  const playerB = match?.player_b;
  const roomLeader = roomParticipants.find((participant) => participant.address !== accountAddress);

  return (
    <div className="space-y-4">
      <section className="glass-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan/80">Battle Room</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{roomModel.heroTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">{roomModel.heroHint}</p>
          </div>
          <button className="btn-ghost" onClick={onBackLobby}>Back To Lobby</button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-300">
          {currentMatchId ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Battle ID {short(currentMatchId)}</span> : null}
          {resolution ? <span className="rounded-full border border-yellow-300/30 bg-yellow-500/10 px-3 py-1 text-yellow-100">Finished</span> : null}
          {roomLeader ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Opponent {short(roomLeader.address)}</span> : null}
        </div>
      </section>

      <section className="arena-stage overflow-hidden rounded-[32px] border border-borderSoft p-4 sm:p-6">
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_120px_1fr] lg:items-center">
          <ArenaMonsterPanel
            title="Player A"
            address={playerA}
            monster={playerAMonster}
            ready={Boolean(match?.mon_a)}
            side="left"
            stateLabel={roomModel.playerAReady ? 'READY' : match?.mon_a ? 'Loaded' : 'Waiting'}
          />

          <div className="grid place-items-center">
            <div className="arena-versus-ring"><span>VS</span></div>
          </div>

          <ArenaMonsterPanel
            title="Player B"
            address={playerB}
            monster={playerBMonster}
            ready={Boolean(match?.mon_b)}
            side="right"
            stateLabel={roomModel.playerBReady ? 'READY' : match?.mon_b ? 'Loaded' : roomModel.opponentStatusLabel}
          />
        </div>
      </section>

      <section className="glass-card space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Your Monsters</div>
            <div className="mt-1 text-xl font-black text-white">Tap one to bring it in</div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
            {monsters.length} ready
          </div>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {monsters.map((monster) => {
            const selected = monster.objectId === selectedMonsterId;
            return (
              <button
                key={monster.objectId}
                className={`w-[170px] shrink-0 rounded-[24px] border p-3 text-left ${selected ? 'border-purple/70 bg-purple/15' : 'border-borderSoft bg-black/20'}`}
                onClick={() => onPickMonster(monster.objectId)}
              >
                <MonsterImage objectId={monster.objectId} monster={monster} className="aspect-square" />
                <div className="mt-2 text-lg font-black text-white">{monster.name}</div>
                <div className="mt-1"><StageBadge stage={monster.stage} /></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="glass-card space-y-4 p-5 sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Wager</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {STAKE_OPTIONS.map((option) => (
            <button
              key={option}
              className={`min-h-[62px] rounded-[18px] border text-base font-black ${selectedStake === option ? 'border-cyan/70 bg-cyan/15 text-white' : 'border-borderSoft bg-black/20 text-gray-300'}`}
              onClick={() => onPickStake(option)}
            >
              {option === '0' ? 'NO' : `${option} SUI`}
            </button>
          ))}
        </div>
      </section>

      {roomNotices.length > 0 ? (
        <section className="glass-card space-y-3 p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Room Feed</div>
          <div className="space-y-2">
            {roomNotices.slice(0, 4).map((notice) => (
              <div key={notice.id} className={`rounded-[18px] border px-4 py-3 text-sm ${notice.tone === 'warn' ? 'border-red-300/25 bg-red-500/10 text-red-100' : notice.tone === 'success' ? 'border-green-300/25 bg-green-500/10 text-green-100' : 'border-borderSoft bg-black/20 text-gray-300'}`}>
                {notice.summary}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="safe-bottom sticky bottom-0 z-20 -mx-4 border-t border-borderSoft bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            className="min-h-[68px] rounded-[22px] border border-red-300/35 bg-red-500/15 text-lg font-black text-red-100 disabled:opacity-50"
            onClick={onWithdraw}
            disabled={!roomModel.canWithdraw || pending !== null}
          >
            WITHDRAW
          </button>
          <button
            className={`min-h-[68px] rounded-[22px] text-lg font-black disabled:opacity-50 ${roomModel.canReady ? 'arena-ready-glow border border-green-300/35 bg-green-500/20 text-green-50' : 'border border-borderSoft bg-black/20 text-gray-300'}`}
            onClick={onToggleReady}
            disabled={!roomModel.canReady || pending !== null}
          >
            READY
          </button>
          <button
            className={`min-h-[68px] rounded-[22px] text-lg font-black disabled:opacity-50 ${roomModel.bothReady ? 'bg-gradient-to-r from-fuchsia-400 to-pink-500 text-slate-950' : 'border border-borderSoft bg-black/20 text-gray-300'}`}
            onClick={roomModel.bothReady ? onOpenBattle : onDeposit}
            disabled={pending !== null || (!roomModel.bothReady && !roomModel.canDeposit)}
          >
            {roomModel.bothReady ? 'OPEN BATTLE' : 'DEPOSIT NFT'}
          </button>
        </div>
      </div>
    </div>
  );
}
