import { powerPreview, short } from '../../lib/format';
import type { ArenaMatch, MatchResolution } from '../../lib/types';
import type { RoomParticipant } from '../network/types';

export type ArenaScreen = 'lobby' | 'room' | 'battle';

export type RoomModel = {
  playerSide: 'a' | 'b' | null;
  playerAReady: boolean;
  playerBReady: boolean;
  bothDeposited: boolean;
  bothReady: boolean;
  playerDeposited: boolean;
  opponentDeposited: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canReady: boolean;
  canStartBattle: boolean;
  heroTitle: string;
  heroHint: string;
  nextActionLabel: string;
  opponentStatusLabel: string;
};

export type BattleFrame = {
  id: string;
  label: string;
  actor: 'left' | 'right' | 'none';
  leftHp: number;
  rightHp: number;
  flash: boolean;
  winnerSide?: 'left' | 'right';
};

export type BattlePreview = {
  leftPower: number;
  rightPower: number;
  winnerSide: 'left' | 'right';
  frames: BattleFrame[];
};

function parseSeed(seed?: string | null): bigint {
  try {
    return BigInt(seed || '0');
  } catch {
    return BigInt(0);
  }
}

function winnerFromStats(match: ArenaMatch): 'left' | 'right' {
  const left = match.monster_a_data;
  const right = match.monster_b_data;
  if (!left || !right) return 'left';

  const leftPower = powerPreview({
    attack: left.attack,
    defense: left.defense,
    speed: left.speed,
    stage: left.stage,
    xp: left.xp,
  });
  const rightPower = powerPreview({
    attack: right.attack,
    defense: right.defense,
    speed: right.speed,
    stage: right.stage,
    xp: right.xp,
  });

  if (leftPower !== rightPower) return leftPower > rightPower ? 'left' : 'right';
  if (left.speed !== right.speed) return left.speed > right.speed ? 'left' : 'right';
  return parseSeed(left.seed) <= parseSeed(right.seed) ? 'left' : 'right';
}

export function buildBattlePreview(match: ArenaMatch | null, resolution?: MatchResolution | null): BattlePreview | null {
  if (!match?.monster_a_data || !match.monster_b_data) return null;

  const leftPower = powerPreview({
    attack: match.monster_a_data.attack,
    defense: match.monster_a_data.defense,
    speed: match.monster_a_data.speed,
    stage: match.monster_a_data.stage,
    xp: match.monster_a_data.xp,
  });
  const rightPower = powerPreview({
    attack: match.monster_b_data.attack,
    defense: match.monster_b_data.defense,
    speed: match.monster_b_data.speed,
    stage: match.monster_b_data.stage,
    xp: match.monster_b_data.xp,
  });

  const winnerSide = resolution
    ? resolution.winner === match.player_a
      ? 'left'
      : 'right'
    : winnerFromStats(match);

  const loserSide = winnerSide === 'left' ? 'right' : 'left';
  const damage = Math.max(28, Math.min(62, 40 + Math.round(Math.abs(leftPower - rightPower) / 6)));
  const loserEndHp = Math.max(0, 100 - damage);

  const frames: BattleFrame[] = [
    {
      id: 'stare-down',
      label: 'Legends lock eyes.',
      actor: 'none',
      leftHp: 100,
      rightHp: 100,
      flash: false,
    },
    {
      id: 'charge',
      label: `${winnerSide === 'left' ? match.monster_a_data.name : match.monster_b_data.name} charges up!`,
      actor: winnerSide,
      leftHp: 100,
      rightHp: 100,
      flash: false,
    },
    {
      id: 'impact',
      label: 'Direct hit!',
      actor: winnerSide,
      leftHp: loserSide === 'left' ? loserEndHp : 100,
      rightHp: loserSide === 'right' ? loserEndHp : 100,
      flash: true,
    },
    {
      id: 'finish',
      label: `${winnerSide === 'left' ? match.monster_a_data.name : match.monster_b_data.name} wins!`,
      actor: winnerSide,
      leftHp: loserSide === 'left' ? loserEndHp : 100,
      rightHp: loserSide === 'right' ? loserEndHp : 100,
      flash: false,
      winnerSide,
    },
  ];

  return { leftPower, rightPower, winnerSide, frames };
}

export function buildRoomModel(input: {
  match: ArenaMatch | null;
  accountAddress?: string | null;
  participants: RoomParticipant[];
  resolution?: MatchResolution | null;
}): RoomModel {
  const { match, accountAddress, participants, resolution } = input;
  const playerSide = match && accountAddress
    ? match.player_a === accountAddress
      ? 'a'
      : match.player_b === accountAddress
        ? 'b'
        : null
    : null;
  const sideAHasMonster = Boolean(match?.mon_a || match?.monster_a_data);
  const sideBHasMonster = Boolean(match?.mon_b || match?.monster_b_data);

  const you = accountAddress ? participants.find((participant) => participant.address === accountAddress) : undefined;
  const opponent = accountAddress ? participants.find((participant) => participant.address !== accountAddress) : undefined;

  const playerDeposited = Boolean(match && playerSide && (playerSide === 'a' ? sideAHasMonster : sideBHasMonster));
  const opponentDeposited = Boolean(match && playerSide && (playerSide === 'a' ? sideBHasMonster : sideAHasMonster));
  const bothDeposited = Boolean(sideAHasMonster && sideBHasMonster);
  const playerAReady = Boolean(match?.player_a && participants.find((participant) => participant.address === match.player_a)?.ready);
  const playerBReady = Boolean(match?.player_b && participants.find((participant) => participant.address === match.player_b)?.ready);
  const bothReady = Boolean(bothDeposited && playerAReady && playerBReady);
  const canDeposit = Boolean(match && playerSide && match.status === 0 && !playerDeposited);
  const canWithdraw = Boolean(match && playerSide && match.status === 0 && playerDeposited);
  const canReady = Boolean(match && playerSide && bothDeposited && match.status === 1);
  const canStartBattle = Boolean(match && bothReady && match.status === 1 && !resolution);

  let heroTitle = 'Pick a trainer.';
  let heroHint = 'Invite a player, accept an invite, and build a room.';
  let nextActionLabel = 'Invite';
  let opponentStatusLabel = opponent?.present ? 'Online' : 'Offline';

  if (!match && participants.length > 0) {
    heroTitle = 'Room open.';
    heroHint = participants.length === 1
      ? 'Invite sent. Wait for the other trainer to accept so the on-chain match can open.'
      : 'Both trainers are here. Wait for the on-chain match to load, then deposit your legends.';
    nextActionLabel = 'Wait';
    opponentStatusLabel = opponent?.present ? 'In room' : 'Invite pending';
  } else if (match && match.status === 3) {
    heroTitle = 'Battle cancelled.';
    heroHint = 'The room was cancelled. Legends should be back with their trainers.';
    nextActionLabel = 'Back to lobby';
    opponentStatusLabel = 'Left room';
  } else if (resolution || match?.status === 2) {
    heroTitle = 'Battle finished.';
    heroHint = 'Watch the result and jump into the next fight.';
    nextActionLabel = 'Watch result';
    opponentStatusLabel = 'Fight ended';
  } else if (match) {
    if (!playerDeposited) {
      heroTitle = 'Send your legend.';
      heroHint = 'Your side is empty. Deposit your NFT and set your wager.';
      nextActionLabel = 'Deposit';
      opponentStatusLabel = opponentDeposited ? 'Legend loaded' : opponent?.present ? 'Choosing legend' : 'Not in room';
    } else if (!opponentDeposited) {
      heroTitle = 'Waiting for the other side.';
      heroHint = 'Your legend is loaded. They still need to deposit theirs.';
      nextActionLabel = 'Wait';
      opponentStatusLabel = opponent?.present ? 'Needs deposit' : 'Left room';
    } else if (!bothReady) {
      heroTitle = 'Both legends loaded.';
      heroHint = 'Tap READY after checking the wager and your monster.';
      nextActionLabel = 'Ready';
      opponentStatusLabel = opponent?.ready ? 'Ready' : opponent?.present ? 'Needs ready' : 'Left room';
    } else {
      heroTitle = 'Battle now.';
      heroHint = 'Anyone can press ATTACK to resolve the fight on-chain.';
      nextActionLabel = 'Battle';
      opponentStatusLabel = 'Ready';
    }
  }

  return {
    playerSide,
    playerAReady,
    playerBReady,
    bothDeposited,
    bothReady,
    playerDeposited,
    opponentDeposited,
    canDeposit,
    canWithdraw,
    canReady,
    canStartBattle,
    heroTitle,
    heroHint,
    nextActionLabel,
    opponentStatusLabel,
  };
}

export function spectatorSummary(match: ArenaMatch): string {
  const left = match.monster_a_data?.name ?? short(match.player_a);
  const right = match.monster_b_data?.name ?? short(match.player_b);
  return `${left} vs ${right}`;
}
