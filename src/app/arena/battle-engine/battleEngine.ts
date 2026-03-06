import type { ArenaMatch, MatchResolution } from '../../lib/types';

export type CoachStep = {
  id: 'invite' | 'room' | 'deposit' | 'wait' | 'battle';
  title: string;
  icon: string;
  done: boolean;
  current: boolean;
  help: string;
};

export type BattleRoomViewModel = {
  statusText: string;
  userSide: 'a' | 'b' | null;
  isPlayerInMatch: boolean;
  userHasDeposited: boolean;
  opponentHasDeposited: boolean;
  bothDeposited: boolean;
  canStartBattle: boolean;
  canWithdraw: boolean;
  winnerSide: 'left' | 'right' | null;
  heroMessage: string;
  yourNextAction: string;
  opponentNextAction: string;
  currentStep: CoachStep;
  coachSteps: CoachStep[];
};

type BuildArgs = {
  match: ArenaMatch | null;
  resolution: MatchResolution | null;
  accountAddress?: string | null;
  awaitingRoomCreation: boolean;
  recoveringMatch: boolean;
  opponentAddress: string;
  incomingInviteCount: number;
};

export function buildBattleRoomViewModel(args: BuildArgs): BattleRoomViewModel {
  const {
    match,
    resolution,
    accountAddress,
    awaitingRoomCreation,
    recoveringMatch,
    opponentAddress,
    incomingInviteCount,
  } = args;

  const userSide = match && accountAddress
    ? accountAddress === match.player_a
      ? 'a'
      : accountAddress === match.player_b
        ? 'b'
        : null
    : null;

  const isPlayerInMatch = Boolean(
    match && accountAddress && (accountAddress === match.player_a || accountAddress === match.player_b)
  );

  const userHasDeposited = Boolean(
    match && userSide && (userSide === 'a' ? match.mon_a : match.mon_b)
  );

  const opponentHasDeposited = Boolean(
    match && userSide && (userSide === 'a' ? match.mon_b : match.mon_a)
  );

  const bothDeposited = Boolean(match?.mon_a && match?.mon_b);
  const canStartBattle = Boolean(match && match.status === 1 && isPlayerInMatch);
  const canWithdraw = Boolean(match && match.status === 0 && isPlayerInMatch);

  const statusText = recoveringMatch
    ? 'SYNCING'
    : awaitingRoomCreation
      ? 'CREATING ROOM'
      : !match
        ? 'LOBBY OPEN'
        : match.status === 0
          ? 'WAITING'
          : match.status === 1
            ? 'LOCKED'
            : match.status === 2
              ? 'FINISHED'
              : 'CANCELLED';

  const hasOpponent = Boolean(opponentAddress.trim());
  const coachSteps: CoachStep[] = [
    {
      id: 'invite',
      title: 'Invite',
      icon: '📨',
      done: hasOpponent || awaitingRoomCreation || Boolean(match),
      current: !hasOpponent && !awaitingRoomCreation && !match,
      help: incomingInviteCount
        ? `${incomingInviteCount} invite${incomingInviteCount > 1 ? 's' : ''} waiting.`
        : 'Tap a trainer in the lobby.',
    },
    {
      id: 'room',
      title: 'Room',
      icon: '🏟️',
      done: Boolean(match),
      current: (hasOpponent || awaitingRoomCreation) && !match,
      help: awaitingRoomCreation ? 'Waiting for the room to appear.' : 'Make the battle room.',
    },
    {
      id: 'deposit',
      title: 'Send',
      icon: '🧩',
      done: userHasDeposited,
      current: Boolean(match) && !userHasDeposited,
      help: userHasDeposited ? 'Your legend is in.' : 'Send your legend.',
    },
    {
      id: 'wait',
      title: 'Wait',
      icon: '👀',
      done: bothDeposited,
      current: userHasDeposited && !bothDeposited,
      help: bothDeposited ? 'Both sides are ready.' : 'Wait for the other side.',
    },
    {
      id: 'battle',
      title: 'Battle',
      icon: '⚔️',
      done: match?.status === 2,
      current: canStartBattle,
      help: canStartBattle ? 'Press battle now.' : 'Battle unlocks after both deposits.',
    },
  ];

  const currentStep = coachSteps.find((step) => step.current)
    ?? coachSteps.find((step) => !step.done)
    ?? coachSteps[coachSteps.length - 1];

  const heroMessage = awaitingRoomCreation
    ? 'Invite accepted. Waiting for the battle room.'
    : !match
      ? hasOpponent
        ? 'Friend picked. Make the room.'
        : 'Pick a trainer and a legend.'
      : match.status === 2
        ? 'Battle over. Winner is below.'
        : match.status === 3
          ? 'Room cancelled. Legends returned.'
          : bothDeposited
            ? 'Both legends are ready. Smash battle.'
            : userHasDeposited
              ? 'Your side is ready. Waiting for the other side.'
              : 'Room is open. Send your legend.';

  const yourNextAction = !accountAddress
    ? 'Connect wallet first.'
    : awaitingRoomCreation
      ? 'Wait for the room.'
      : !match
        ? hasOpponent
          ? 'Tap Make Room.'
          : 'Tap Invite Friend.'
        : !isPlayerInMatch
          ? 'You are watching only.'
          : match.status === 2
            ? 'Check result or play again.'
            : match.status === 3
              ? 'Go back to the lobby.'
              : !userHasDeposited
                ? 'Tap Send Legend!'
                : !bothDeposited
                  ? 'Wait or leave the room.'
                  : canStartBattle
                    ? 'Tap Start Battle.'
                    : 'Ready. Waiting for battle.';

  const opponentNextAction = awaitingRoomCreation
    ? 'Waiting for room creation.'
    : !match
      ? hasOpponent
        ? 'They need to accept and join.'
        : 'No opponent yet.'
      : match.status === 2
        ? 'They already finished.'
        : match.status === 3
          ? 'They left or room was cancelled.'
          : !opponentHasDeposited
            ? 'They need to send a legend.'
            : !userHasDeposited
              ? 'They are waiting for you.'
              : 'They are ready.';

  const winnerSide = resolution && match
    ? resolution.winner === match.player_a
      ? 'left'
      : resolution.winner === match.player_b
        ? 'right'
        : null
    : null;

  return {
    statusText,
    userSide,
    isPlayerInMatch,
    userHasDeposited,
    opponentHasDeposited,
    bothDeposited,
    canStartBattle,
    canWithdraw,
    winnerSide,
    heroMessage,
    yourNextAction,
    opponentNextAction,
    currentStep,
    coachSteps,
  };
}
