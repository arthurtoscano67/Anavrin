import { StageBadge } from '../../components/StageBadge';
import { MonsterImage } from '../../components/MonsterImage';
import { short } from '../../lib/format';
import type { ArenaMatch, MatchResolution, Monster } from '../../lib/types';
import type { LobbyConnectionState, RoomNotice, RoomParticipant } from '../network/types';
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
  roomConnectionState,
  roomIsConnected,
  roomLastError,
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
  onBattle,
  onBackLobby,
}: {
  accountAddress?: string;
  match: ArenaMatch | null;
  currentMatchId?: string;
  currentRoomId?: string;
  roomConnectionState: LobbyConnectionState;
  roomIsConnected: boolean;
  roomLastError: string | null;
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
  onBattle: () => void;
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
  const roomCanOpen = waitingForMatch && canCreateRoomMatch;
  const sideAHasMonster = Boolean(match?.mon_a || match?.monster_a_data);
  const sideBHasMonster = Boolean(match?.mon_b || match?.monster_b_data);
  const sideAStateLabel = roomModel.playerAReady ? 'Ready' : sideAHasMonster ? 'Deposited' : playerAAddress ? 'Waiting' : 'Open';
  const sideBStateLabel = roomModel.playerBReady ? 'Ready' : sideBHasMonster ? 'Deposited' : playerBAddress ? 'Waiting' : 'Open';
  const showBattleButton = roomModel.bothReady && Boolean(currentMatchId);
  const actionDisabled = pending !== null;
  const withdrawLocked = Boolean(match?.status === 1 || match?.status === 2 || match?.status === 3);
  const playerReady = roomModel.playerReady;
  const opponentReady = roomModel.opponentReady;
  const selectedMonster = monsters.find((monster) => monster.objectId === selectedMonsterId) ?? null;
  const selectionLocked = roomModel.playerDeposited || actionDisabled;
  const connectionLabel = roomConnectionState === 'open'
    ? 'Room Live'
    : roomConnectionState === 'connecting'
      ? 'Reconnecting'
      : roomConnectionState === 'error'
        ? 'Room Offline'
        : 'Room Closed';

  const flowStep = showBattleButton
    ? 4
    : roomModel.bothDeposited || playerReady || opponentReady
      ? 3
      : currentMatchId
        ? 2
        : 1;

  const flowSteps = [
    { id: 1, label: 'Invite' },
    { id: 2, label: 'Deposit' },
    { id: 3, label: 'Ready' },
    { id: 4, label: 'Battle' },
  ];

  const guide = (() => {
    if (resolution) {
      return {
        eyebrow: 'Battle complete',
        title: 'Legends sent home.',
        body: 'The fight is done. Your monsters have been updated on-chain and returned to their wallets.',
        primaryLabel: 'Back To Lobby',
        primaryTone: 'from-purple to-cyan',
        primaryDisabled: actionDisabled,
        primaryAction: onBackLobby,
        statusLabel: 'Complete',
        statusTone: 'border-yellow-300/30 bg-yellow-500/10 text-yellow-100',
      };
    }

    if (waitingForMatch) {
      if (roomCanOpen) {
        return {
          eyebrow: 'Step 1',
          title: 'Open the battle room.',
          body: 'Both trainers are here. Tap once to create the shared battle pool on-chain.',
          primaryLabel: pending === 'create-room' ? 'Opening...' : 'Open Battle Room',
          primaryTone: 'from-cyan to-sky-400',
          primaryDisabled: actionDisabled,
          primaryAction: onCreateRoomMatch,
          statusLabel: 'Both Here',
          statusTone: 'border-cyan/30 bg-cyan/10 text-cyan-50',
        };
      }

      return {
        eyebrow: 'Step 1',
        title: 'Waiting for invite accept.',
        body: 'Your room is ready. The next thing that happens is the other trainer taps ACCEPT.',
        primaryLabel: 'Waiting for Trainer',
        primaryTone: 'from-slate-700 to-slate-600',
        primaryDisabled: true,
        primaryAction: undefined,
        statusLabel: 'Invite Sent',
        statusTone: 'border-cyan/30 bg-cyan/10 text-cyan-50',
      };
    }

    if (!roomModel.playerDeposited) {
      return {
        eyebrow: 'Step 2',
        title: 'Deposit your legend.',
        body: selectedMonster
          ? `${selectedMonster.name} is selected. Deposit it now${selectedStake !== '0' ? ` with ${selectedStake} SUI` : ''}.`
          : 'Pick a legend below, then deposit it into the battle pool.',
        primaryLabel: pending === 'deposit' ? 'Depositing...' : 'Deposit Legend',
        primaryTone: 'from-cyan to-purple',
        primaryDisabled: actionDisabled || !roomModel.canDeposit,
        primaryAction: onDeposit,
        statusLabel: roomModel.canDeposit ? 'Your Turn' : 'Pick Legend',
        statusTone: roomModel.canDeposit ? 'border-cyan/30 bg-cyan/10 text-cyan-50' : 'border-white/10 bg-white/5 text-gray-200',
      };
    }

    if (!roomModel.opponentDeposited) {
      return {
        eyebrow: 'Step 2',
        title: 'Waiting for opponent deposit.',
        body: roomModel.canWithdraw
          ? 'Your legend is safe in the pool. You can still withdraw for safety until the other trainer deposits.'
          : 'Your legend is safe in the pool. Waiting for the other trainer to load theirs.',
        primaryLabel: 'Waiting for Opponent',
        primaryTone: 'from-slate-700 to-slate-600',
        primaryDisabled: true,
        primaryAction: undefined,
        statusLabel: 'Legend Deposited',
        statusTone: 'border-green-300/30 bg-green-500/10 text-green-100',
      };
    }

    if (!playerReady) {
      return {
        eyebrow: 'Step 3',
        title: roomIsConnected ? 'Tap READY.' : 'Reconnecting room link.',
        body: roomIsConnected
          ? 'Both legends are in. One tap marks you ready and lights up battle once the other trainer is ready too.'
          : roomLastError ?? 'The room is reconnecting. READY unlocks as soon as the room link is live again.',
        primaryLabel: roomIsConnected ? 'Ready Up' : 'Reconnecting...',
        primaryTone: roomIsConnected ? 'from-green-400 to-emerald-500' : 'from-slate-700 to-slate-600',
        primaryDisabled: actionDisabled || !roomModel.canReady || !roomIsConnected,
        primaryAction: onToggleReady,
        statusLabel: roomIsConnected ? 'Ready Needed' : connectionLabel,
        statusTone: roomIsConnected ? 'border-green-300/30 bg-green-500/10 text-green-100' : 'border-red-300/25 bg-red-500/10 text-red-100',
      };
    }

    if (!opponentReady) {
      return {
        eyebrow: 'Step 3',
        title: 'You are ready.',
        body: 'Stay here. As soon as the other trainer taps READY, the battle button will light up automatically.',
        primaryLabel: 'Waiting for Ready',
        primaryTone: 'from-green-400 to-emerald-500',
        primaryDisabled: true,
        primaryAction: undefined,
        statusLabel: 'Ready!',
        statusTone: 'border-green-300/30 bg-green-500/10 text-green-100',
      };
    }

    return {
      eyebrow: 'Step 4',
      title: 'Battle now.',
      body: 'Both trainers are ready. Tap once to resolve the fight on-chain and send both legends back home.',
      primaryLabel: pending === 'battle' ? 'Battling...' : 'Battle Now',
      primaryTone: 'from-fuchsia-400 via-pink-400 to-orange-300',
      primaryDisabled: actionDisabled || !showBattleButton,
      primaryAction: onBattle,
      statusLabel: 'Go Time',
      statusTone: 'border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-50',
    };
  })();

  return (
    <div className="space-y-4 pb-40 sm:pb-44">
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
          <span className={`rounded-full border px-3 py-1 ${roomIsConnected ? 'border-cyan/30 bg-cyan/10 text-cyan-50' : roomConnectionState === 'connecting' ? 'border-yellow-300/25 bg-yellow-500/10 text-yellow-100' : 'border-red-300/25 bg-red-500/10 text-red-100'}`}>
            {connectionLabel}
          </span>
        </div>

        {waitingForMatch ? (
          <div className="rounded-[22px] border border-cyan/30 bg-cyan/10 p-4 text-sm text-cyan-50">
            Invite sent. This room is live already. When the other trainer accepts, the battle vault opens and deposit becomes available.
          </div>
        ) : null}
      </section>

      <section className="glass-card space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Next Move</div>
            <div className="mt-1 text-xl font-black text-white">{guide.title}</div>
          </div>
          <div className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${guide.statusTone}`}>
            {guide.statusLabel}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {flowSteps.map((step) => {
            const active = flowStep === step.id;
            const done = flowStep > step.id;
            return (
              <div
                key={step.id}
                className={`rounded-[18px] border px-4 py-3 text-center text-sm font-black uppercase tracking-[0.16em] ${
                  active
                    ? 'border-purple/45 bg-purple/15 text-white'
                    : done
                      ? 'border-green-300/30 bg-green-500/10 text-green-100'
                      : 'border-white/10 bg-white/5 text-gray-300'
                }`}
              >
                {step.id}. {step.label}
              </div>
            );
          })}
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan/80">{guide.eyebrow}</div>
          <p className="mt-2 text-sm leading-6 text-gray-200">{guide.body}</p>
          {roomLastError && !roomIsConnected ? (
            <p className="mt-2 text-xs font-semibold text-red-200">{roomLastError}</p>
          ) : null}
        </div>
      </section>

      {showBattleButton ? (
        <section className="glass-card rounded-[28px] border border-fuchsia-300/30 bg-gradient-to-r from-fuchsia-500/15 to-pink-500/10 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-100">Battle Ready</div>
              <div className="mt-2 text-2xl font-black text-white">Both legends are ready to fight.</div>
              <div className="mt-1 text-sm text-fuchsia-50/85">Stay in this room and tap the battle button below.</div>
            </div>
            <div className="rounded-full border border-fuchsia-200/35 bg-fuchsia-500/15 px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-fuchsia-50">
              LIVE
            </div>
          </div>
        </section>
      ) : null}

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
          {[
            {
              title: 'Player A',
              isYou: youArePlayerA,
              deposited: sideAHasMonster,
              ready: roomModel.playerAReady,
              canWithdrawNow: Boolean(sideAHasMonster && match?.status === 0),
            },
            {
              title: 'Player B',
              isYou: youArePlayerB,
              deposited: sideBHasMonster,
              ready: roomModel.playerBReady,
              canWithdrawNow: Boolean(sideBHasMonster && match?.status === 0),
            },
          ].map((side) => (
            <div key={side.title} className="rounded-[22px] border border-white/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black uppercase tracking-[0.16em] text-white/80">{side.title}</div>
                {side.isYou ? <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">YOU</span> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${side.deposited ? 'border-green-300/35 bg-green-500/15 text-green-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                  {side.deposited ? 'Deposited' : 'Waiting'}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${side.ready ? 'border-green-300/35 bg-green-500/15 text-green-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                  {side.ready ? 'Ready' : 'Not Ready'}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${side.canWithdrawNow ? 'border-red-300/35 bg-red-500/15 text-red-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                  {side.canWithdrawNow ? 'Can Withdraw' : withdrawLocked && side.deposited ? 'Locked In' : 'Safe'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Your Monsters</div>
            <div className="mt-1 text-xl font-black text-white">
              {roomModel.playerDeposited ? 'Legend locked into the room' : 'Tap one to bring it in'}
            </div>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
            {monsters.length} ready
          </div>
        </div>
        {roomModel.playerDeposited ? (
          <div className="rounded-[18px] border border-green-300/25 bg-green-500/10 px-4 py-3 text-sm text-green-100">
            Your legend is already in the battle pool. Withdraw first if you want to switch.
          </div>
        ) : null}
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {monsters.map((monster) => {
            const selected = monster.objectId === selectedMonsterId;
            return (
              <button
                key={monster.objectId}
                className={`w-[170px] shrink-0 rounded-[24px] border p-3 text-left disabled:opacity-45 ${selected ? 'border-purple/70 bg-purple/15' : 'border-borderSoft bg-black/20'}`}
                onClick={() => onPickMonster(monster.objectId)}
                disabled={selectionLocked}
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
        <div className="text-sm text-gray-300">
          {roomModel.playerDeposited
            ? 'Wager is locked because your legend is already in the pool.'
            : 'Optional. Pick a wager before you deposit.'}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {STAKE_OPTIONS.map((option) => (
            <button
              key={option}
              className={`min-h-[62px] rounded-[18px] border text-base font-black disabled:opacity-45 ${selectedStake === option ? 'border-cyan/70 bg-cyan/15 text-white' : 'border-borderSoft bg-black/20 text-gray-300'}`}
              onClick={() => onPickStake(option)}
              disabled={selectionLocked}
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

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-borderSoft bg-background/95 px-4 py-3 shadow-[0_-18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan/80">{guide.eyebrow}</div>
            <div className="mt-1 text-lg font-black text-white">{guide.title}</div>
            <div className="mt-1 text-sm text-gray-200">{guide.body}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.7fr]">
            <button
              className={`min-h-[68px] rounded-[22px] border text-base font-black uppercase tracking-[0.14em] disabled:opacity-50 ${
                roomModel.canWithdraw
                  ? 'border-red-300/35 bg-red-500/15 text-red-100'
                  : 'border-white/10 bg-white/5 text-gray-200'
              }`}
              onClick={roomModel.canWithdraw ? onWithdraw : onBackLobby}
              disabled={actionDisabled}
            >
              {roomModel.canWithdraw ? 'Withdraw Safely' : resolution ? 'Back To Lobby' : withdrawLocked ? 'Pool Locked' : 'Back To Lobby'}
            </button>
            <button
              className={`min-h-[76px] rounded-[24px] px-5 text-lg font-black uppercase tracking-[0.16em] text-white disabled:opacity-50 ${
                showBattleButton
                  ? `arena-ready-glow arena-battle-shake bg-gradient-to-r ${guide.primaryTone}`
                  : guide.primaryDisabled
                    ? 'border border-borderSoft bg-black/20 text-gray-300'
                    : `bg-gradient-to-r ${guide.primaryTone}`
              }`}
              onClick={guide.primaryAction}
              disabled={guide.primaryDisabled}
            >
              {guide.primaryLabel}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-gray-200">
              You: {roomModel.playerDeposited ? (playerReady ? 'Ready' : 'Deposited') : 'Picking'}
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] text-gray-200">
              Opponent: {roomModel.opponentDeposited ? (opponentReady ? 'Ready' : 'Deposited') : 'Waiting'}
            </div>
            <div className={`rounded-[18px] border px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] ${roomModel.canWithdraw ? 'border-red-300/35 bg-red-500/15 text-red-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>
              {roomModel.canWithdraw ? 'Safety Exit Open' : 'Safety Exit Closed'}
            </div>
            <div className={`rounded-[18px] border px-4 py-3 text-center text-xs font-black uppercase tracking-[0.14em] ${showBattleButton ? 'border-fuchsia-300/35 bg-fuchsia-500/15 text-fuchsia-50' : 'border-white/10 bg-white/5 text-gray-300'}`}>
              {showBattleButton ? 'Battle Lit Up' : roomModel.canReady ? 'Ready Window' : flowStep === 1 ? 'Invite Step' : 'Loading'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
