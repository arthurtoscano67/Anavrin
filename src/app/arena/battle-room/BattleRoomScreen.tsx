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
  currentRoomId,
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
  canCreateRoomMatch,
  onPickMonster,
  onPickStake,
  onCreateRoomMatch,
  onDeposit,
  onWithdraw,
  onToggleReady,
  onOpenBattle,
  onBackLobby,
}: {
  accountAddress?: string;
  match: ArenaMatch | null;
  currentMatchId?: string;
  currentRoomId?: string;
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
  canCreateRoomMatch: boolean;
  onPickMonster: (monsterId: string) => void;
  onPickStake: (stake: string) => void;
  onCreateRoomMatch: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onToggleReady: () => void;
  onOpenBattle: () => void;
  onBackLobby: () => void;
}) {
  const playerA = match?.player_a;
  const playerB = match?.player_b;
  const roomLeader = roomParticipants.find((participant) => participant.address !== accountAddress);
  const playerAAddress = playerA ?? roomParticipants[0]?.address;
  const playerBAddress = playerB ?? roomParticipants.find((participant) => participant.address !== playerAAddress)?.address;
  const youArePlayerA = Boolean(accountAddress && playerAAddress === accountAddress);
  const youArePlayerB = Boolean(accountAddress && playerBAddress === accountAddress);
  const waitingForMatch = Boolean(currentRoomId && !currentMatchId);
  const roomWaitingForTrainer = waitingForMatch && !canCreateRoomMatch;
  const roomCanOpen = waitingForMatch && canCreateRoomMatch;
  const sideAHasMonster = Boolean(match?.mon_a || match?.monster_a_data);
  const sideBHasMonster = Boolean(match?.mon_b || match?.monster_b_data);
  const sideAStateLabel = roomModel.playerAReady ? 'Ready' : sideAHasMonster ? 'Deposited' : playerAAddress ? 'Waiting' : 'Open';
  const sideBStateLabel = roomModel.playerBReady ? 'Ready' : sideBHasMonster ? 'Deposited' : playerBAddress ? 'Waiting' : 'Open';
  const showBattleButton = roomModel.bothReady && Boolean(currentMatchId);

  const ActionBadge = ({
    label,
    active,
  }: {
    label: string;
    active: boolean;
  }) => (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
        active
          ? 'border border-green-300/35 bg-green-500/15 text-green-100'
          : 'border border-white/10 bg-white/5 text-gray-300'
      }`}
    >
      {label}
    </span>
  );

  const ActionButton = ({
    label,
    tone = 'neutral',
    active = false,
    disabled = false,
    onClick,
  }: {
    label: string;
    tone?: 'neutral' | 'green' | 'pink' | 'red';
    active?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }) => {
    const toneClass = tone === 'green'
      ? active
        ? 'border-green-300/45 bg-green-500/20 text-green-50'
        : 'border-green-300/25 bg-green-500/10 text-green-100'
      : tone === 'pink'
        ? active
          ? 'border-pink-300/45 bg-pink-500/20 text-pink-50'
          : 'border-pink-300/25 bg-pink-500/10 text-pink-100'
        : tone === 'red'
          ? 'border-red-300/35 bg-red-500/15 text-red-100'
          : active
            ? 'border-white/20 bg-white/15 text-white'
            : 'border-white/10 bg-white/5 text-gray-200';

    return (
      <button
        className={`min-h-[48px] rounded-full border px-4 text-sm font-black uppercase tracking-[0.14em] transition disabled:opacity-45 ${toneClass}`}
        onClick={onClick}
        disabled={disabled}
      >
        {label}
      </button>
    );
  };

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
          {currentRoomId ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Room {short(currentRoomId)}</span> : null}
          {currentMatchId ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Battle ID {short(currentMatchId)}</span> : null}
          {resolution ? <span className="rounded-full border border-yellow-300/30 bg-yellow-500/10 px-3 py-1 text-yellow-100">Finished</span> : null}
          {roomLeader ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Opponent {short(roomLeader.address)}</span> : null}
        </div>

        {waitingForMatch ? (
          <div className="rounded-[22px] border border-cyan/30 bg-cyan/10 p-4 text-sm text-cyan-50">
            Invite sent. This room is live already. When the other trainer accepts, the battle vault opens and deposit becomes available.
          </div>
        ) : null}
      </section>

      <section className="arena-stage overflow-hidden rounded-[32px] border border-borderSoft p-4 sm:p-6">
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1fr_120px_1fr] lg:items-center">
          <ArenaMonsterPanel
            title="Player A"
            address={playerAAddress}
            monster={playerAMonster}
            ready={sideAHasMonster}
            side="left"
            stateLabel={sideAStateLabel}
          />

          <div className="grid place-items-center">
            <div className="arena-versus-ring"><span>VS</span></div>
          </div>

          <ArenaMonsterPanel
            title="Player B"
            address={playerBAddress}
            monster={playerBMonster}
            ready={sideBHasMonster}
            side="right"
            stateLabel={sideBStateLabel}
          />
        </div>

        <div className="relative z-10 mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-white/80">Player A</div>
              {youArePlayerA ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">YOU</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {youArePlayerA ? (
                <>
                  <ActionButton
                    label={sideAHasMonster ? 'Deposited' : 'Deposit'}
                    tone="neutral"
                    active={sideAHasMonster}
                    disabled={pending !== null || !roomModel.canDeposit}
                    onClick={onDeposit}
                  />
                  <ActionButton
                    label={roomModel.playerAReady ? 'Ready!' : 'Ready'}
                    tone="green"
                    active={roomModel.playerAReady}
                    disabled={pending !== null || !roomModel.canReady}
                    onClick={onToggleReady}
                  />
                  <ActionButton
                    label="Withdraw"
                    tone="red"
                    active={Boolean(match?.status === 0 && sideAHasMonster)}
                    disabled={pending !== null || !roomModel.canWithdraw}
                    onClick={onWithdraw}
                  />
                  {showBattleButton ? (
                    <ActionButton
                      label="Battle"
                      tone="pink"
                      active
                      disabled={pending !== null}
                      onClick={onOpenBattle}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <ActionBadge label="Deposit" active={sideAHasMonster} />
                  <ActionBadge label="Ready" active={roomModel.playerAReady} />
                  <ActionBadge label="Withdraw" active={Boolean(sideAHasMonster && match?.status === 0)} />
                </>
              )}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-black uppercase tracking-[0.16em] text-white/80">Player B</div>
              {youArePlayerB ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">YOU</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {youArePlayerB ? (
                <>
                  <ActionButton
                    label={sideBHasMonster ? 'Deposited' : 'Deposit'}
                    tone="neutral"
                    active={sideBHasMonster}
                    disabled={pending !== null || !roomModel.canDeposit}
                    onClick={onDeposit}
                  />
                  <ActionButton
                    label={roomModel.playerBReady ? 'Ready!' : 'Ready'}
                    tone="green"
                    active={roomModel.playerBReady}
                    disabled={pending !== null || !roomModel.canReady}
                    onClick={onToggleReady}
                  />
                  <ActionButton
                    label="Withdraw"
                    tone="red"
                    active={Boolean(match?.status === 0 && sideBHasMonster)}
                    disabled={pending !== null || !roomModel.canWithdraw}
                    onClick={onWithdraw}
                  />
                  {showBattleButton ? (
                    <ActionButton
                      label="Battle"
                      tone="pink"
                      active
                      disabled={pending !== null}
                      onClick={onOpenBattle}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <ActionBadge label="Deposit" active={sideBHasMonster} />
                  <ActionBadge label="Ready" active={roomModel.playerBReady} />
                  <ActionBadge label="Withdraw" active={Boolean(sideBHasMonster && match?.status === 0)} />
                </>
              )}
            </div>
          </div>
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
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-4">
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
            onClick={showBattleButton ? onOpenBattle : roomCanOpen ? onCreateRoomMatch : onDeposit}
            disabled={pending !== null || (showBattleButton ? false : roomCanOpen ? false : roomWaitingForTrainer || !roomModel.canDeposit || !currentMatchId)}
          >
            {showBattleButton ? 'BATTLE' : roomCanOpen ? 'OPEN ROOM' : roomWaitingForTrainer ? 'WAITING FOR TRAINER' : 'DEPOSIT'}
          </button>
          <div className="grid place-items-center rounded-[22px] border border-white/10 bg-white/5 px-4 text-center text-sm font-semibold text-gray-300">
            {showBattleButton
              ? 'Both legends are ready. Enter battle now.'
              : roomCanOpen
                ? 'Both trainers are here. Open the battle room to unlock deposits.'
                : 'Battle unlocks when both trainers deposit and tap READY.'}
          </div>
        </div>
      </div>
    </div>
  );
}
