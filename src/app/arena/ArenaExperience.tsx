import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageShell } from '../components/PageShell';
import { LoadingGrid } from '../components/LoadingGrid';
import { useAnavrinData } from '../hooks/useAnavrinData';
import { useArenaMatches } from '../hooks/useArenaMatches';
import { useTxExecutor } from '../hooks/useTxExecutor';
import { ARENA_MATCH_TYPE, CLOCK_ID, MODULE, PACKAGE_ID, TREASURY_ID } from '../lib/constants';
import { short, toMist } from '../lib/format';
import { fetchArenaMatch, fetchMatchResolution } from '../lib/sui';
import type { ArenaMatch, MatchResolution, Monster } from '../lib/types';
import { buildBattlePreview, buildRoomModel, type ArenaScreen } from './battle-engine/battleEngine';
import { BattleRoomScreen } from './battle-room/BattleRoomScreen';
import { BattleArenaScreen } from './arena-ui/BattleArenaScreen';
import { LobbyScreen } from './lobby/LobbyScreen';
import { useLobbyPresence } from './network/useLobbyPresence';
import { useRoomPresence } from './network/useRoomPresence';
import type { LobbyInvite, LobbyOpenMatch } from './network/types';

function buildPreviewMonster(participant?: { monsterId?: string; monsterName?: string; stage?: number } | null) {
  if (!participant?.monsterId) return null;
  return {
    objectId: participant.monsterId,
    name: participant.monsterName ?? 'Legend',
    stage: participant.stage ?? 0,
  };
}

function isRoomMessageRelevant(match: ArenaMatch | null, accountAddress?: string | null): boolean {
  if (!match || !accountAddress) return false;
  return match.player_a === accountAddress || match.player_b === accountAddress;
}

export function ArenaExperience() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [params, setParams] = useSearchParams();
  const { walletMonsters, recentMatches } = useAnavrinData();
  const arenaMatches = useArenaMatches(account?.address);
  const { execute, executeAndFetchBlock } = useTxExecutor();

  const [selectedMonsterId, setSelectedMonsterId] = useState(params.get('monster') ?? '');
  const [selectedStake, setSelectedStake] = useState('0');
  const [currentMatchId, setCurrentMatchId] = useState(params.get('match') ?? '');
  const [activeMatch, setActiveMatch] = useState<ArenaMatch | null>(null);
  const [resolution, setResolution] = useState<MatchResolution | null>(null);
  const [screen, setScreen] = useState<ArenaScreen>('lobby');
  const [pending, setPending] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [animatingBattle, setAnimatingBattle] = useState(false);

  const monsters = walletMonsters.data ?? [];
  const selectedMonster = useMemo(
    () => monsters.find((monster) => monster.objectId === selectedMonsterId) ?? monsters[0] ?? null,
    [monsters, selectedMonsterId]
  );

  useEffect(() => {
    if (!selectedMonsterId && monsters[0]) {
      setSelectedMonsterId(monsters[0].objectId);
    }
  }, [monsters, selectedMonsterId]);

  const roomPresenceEnabled = Boolean(
    account?.address &&
    currentMatchId &&
    (!activeMatch || isRoomMessageRelevant(activeMatch, account.address))
  );

  const lobby = useLobbyPresence({
    enabled: Boolean(account?.address),
    address: account?.address,
    monsterName: selectedMonster?.name ?? 'Legend',
    level: (selectedMonster?.stage ?? 0) + 1,
  });

  const room = useRoomPresence({
    enabled: roomPresenceEnabled,
    roomId: currentMatchId || undefined,
    address: account?.address,
  });

  const lobbyStartedMatch = lobby.startedMatch;
  const clearLobbyStartedMatch = lobby.clearStartedMatch;
  const roomIsConnected = room.isConnected;
  const roomSetSelection = room.setSelection;
  const roomSetStake = room.setStake;
  const roomSetReady = room.setReady;

  useEffect(() => {
    if (!selectedMonster || !roomIsConnected) return;
    roomSetSelection({
      monsterId: selectedMonster.objectId,
      monsterName: selectedMonster.name,
      stage: selectedMonster.stage,
    });
  }, [roomIsConnected, roomSetSelection, selectedMonster]);

  useEffect(() => {
    if (!roomIsConnected) return;
    roomSetStake(selectedStake);
  }, [roomIsConnected, roomSetStake, selectedStake]);

  const loadMatch = useCallback(async (matchId: string, nextScreen: ArenaScreen = 'room') => {
    if (!matchId) return;
    setPending('load');
    try {
      const [match, nextResolution] = await Promise.all([
        fetchArenaMatch(client, matchId),
        fetchMatchResolution(client, matchId),
      ]);
      setActiveMatch(match);
      setResolution(nextResolution);
      setCurrentMatchId(matchId);
      arenaMatches.persistMatchId(matchId);
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('match', matchId);
        return next;
      });
      setScreen(nextResolution || match?.status === 2 ? 'battle' : nextScreen);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load match');
    } finally {
      setPending(null);
    }
  }, [arenaMatches, client, setParams]);

  useEffect(() => {
    const urlMonster = params.get('monster');
    if (urlMonster) setSelectedMonsterId(urlMonster);

    const urlMatch = params.get('match');
    if (urlMatch && activeMatch?.objectId !== urlMatch) {
      setCurrentMatchId(urlMatch);
      void loadMatch(urlMatch, 'battle');
      return;
    }

    if (!urlMatch && !currentMatchId && arenaMatches.restoredOwnedMatch) {
      void loadMatch(arenaMatches.restoredOwnedMatch.objectId, 'room');
    }
  }, [activeMatch?.objectId, arenaMatches.restoredOwnedMatch, currentMatchId, loadMatch, params]);

  useEffect(() => {
    if (!currentMatchId || activeMatch?.objectId === currentMatchId) return;
    void loadMatch(currentMatchId, screen === 'battle' ? 'battle' : 'room');
  }, [activeMatch?.objectId, currentMatchId, loadMatch, screen]);

  useEffect(() => {
    if (!lobbyStartedMatch?.matchId) return;
    if (lobbyStartedMatch.matchId === currentMatchId) {
      clearLobbyStartedMatch();
      return;
    }
    void loadMatch(lobbyStartedMatch.matchId, 'room');
    toast.success(`Battle room ready with ${short(lobbyStartedMatch.from === account?.address ? lobbyStartedMatch.to : lobbyStartedMatch.from)}.`);
    clearLobbyStartedMatch();
  }, [account?.address, clearLobbyStartedMatch, currentMatchId, loadMatch, lobbyStartedMatch]);

  useEffect(() => {
    if (!currentMatchId || !activeMatch || !isRoomMessageRelevant(activeMatch, account?.address)) return;
    if (activeMatch.status === 2 || resolution) {
      setScreen('battle');
      return;
    }
    if (room.roomReady && activeMatch.status === 1) {
      setScreen('battle');
    }
  }, [account?.address, activeMatch, currentMatchId, resolution, room.roomReady]);

  const roomModel = useMemo(
    () => buildRoomModel({
      match: activeMatch,
      accountAddress: account?.address,
      participants: room.participants,
      resolution,
    }),
    [account?.address, activeMatch, resolution, room.participants]
  );

  const battlePreview = useMemo(() => buildBattlePreview(activeMatch, resolution), [activeMatch, resolution]);

  const playerAParticipant = useMemo(
    () => (activeMatch ? room.participants.find((participant) => participant.address === activeMatch.player_a) : undefined),
    [activeMatch, room.participants]
  );
  const playerBParticipant = useMemo(
    () => (activeMatch ? room.participants.find((participant) => participant.address === activeMatch.player_b) : undefined),
    [activeMatch, room.participants]
  );

  const playerAMonster = activeMatch?.monster_a_data ?? buildPreviewMonster(playerAParticipant) ?? (activeMatch?.player_a === account?.address ? selectedMonster : null);
  const playerBMonster = activeMatch?.monster_b_data ?? buildPreviewMonster(playerBParticipant) ?? (activeMatch?.player_b === account?.address ? selectedMonster : null);

  const createMatchAgainst = useCallback(async (opponentAddress: string, meta?: { inviteId?: string; openMatchId?: string }) => {
    if (!account?.address) {
      toast.error('Connect wallet first');
      return;
    }
    if (!selectedMonster) {
      toast.error('Pick a monster first');
      return;
    }

    setPending('create-room');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::create_match`,
        arguments: [tx.pure.address(opponentAddress), tx.object(CLOCK_ID)],
      });

      const { block } = await executeAndFetchBlock(tx, 'Battle room created');
      const created = block.objectChanges?.find((change) => change.type === 'created' && change.objectType === ARENA_MATCH_TYPE);
      if (!created || !('objectId' in created)) {
        throw new Error('Could not parse the room id');
      }

      const matchId = created.objectId;
      lobby.announceMatchStarted({
        from: account.address,
        to: opponentAddress,
        inviteId: meta?.inviteId,
        openMatchId: meta?.openMatchId,
        matchId,
      });
      await loadMatch(matchId, 'room');
    } finally {
      setPending(null);
    }
  }, [account?.address, executeAndFetchBlock, loadMatch, lobby, selectedMonster]);

  const handleInvite = useCallback((address: string) => {
    if (!selectedMonster) {
      toast.error('Pick your legend first');
      return;
    }
    lobby.invitePlayer(address);
    toast.success(`Invite sent to ${short(address)}.`);
  }, [lobby, selectedMonster]);

  const handleAcceptInvite = useCallback(async (invite: LobbyInvite) => {
    await createMatchAgainst(invite.from, { inviteId: invite.id });
  }, [createMatchAgainst]);

  const handleJoinOpenMatch = useCallback(async (openMatch: LobbyOpenMatch) => {
    await createMatchAgainst(openMatch.creator, { openMatchId: openMatch.id });
  }, [createMatchAgainst]);

  const handleDeposit = useCallback(async () => {
    if (!account?.address || !currentMatchId || !selectedMonster) {
      toast.error('Pick a room and a legend first');
      return;
    }

    setPending('deposit');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::deposit_monster`,
        arguments: [tx.object(currentMatchId), tx.object(selectedMonster.objectId), tx.object(CLOCK_ID)],
      });

      const stakeMist = toMist(selectedStake);
      if (stakeMist > 0n) {
        const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(stakeMist)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::deposit_stake`,
          arguments: [tx.object(currentMatchId), stakeCoin, tx.object(CLOCK_ID)],
        });
      }

      await execute(tx, 'Legend deposited');
      roomSetReady(false);
      await walletMonsters.refetch();
      await loadMatch(currentMatchId, 'room');
    } finally {
      setPending(null);
    }
  }, [account?.address, currentMatchId, execute, loadMatch, roomSetReady, selectedMonster, selectedStake, walletMonsters]);

  const handleWithdraw = useCallback(async () => {
    if (!currentMatchId) return;
    setPending('withdraw');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::withdraw`,
        arguments: [tx.object(currentMatchId)],
      });
      await execute(tx, 'Legend returned');
      roomSetReady(false);
      await walletMonsters.refetch();
      await loadMatch(currentMatchId, 'room');
    } finally {
      setPending(null);
    }
  }, [currentMatchId, execute, loadMatch, roomSetReady, walletMonsters]);

  const handleToggleReady = useCallback(() => {
    const you = room.participants.find((participant) => participant.address === account?.address);
    roomSetReady(!you?.ready);
  }, [account?.address, room.participants, roomSetReady]);

  const playFrames = useCallback(async () => {
    if (!battlePreview) return;
    setAnimatingBattle(true);
    setFrameIndex(0);
    for (let i = 0; i < battlePreview.frames.length; i += 1) {
      setFrameIndex(i);
      await new Promise((resolve) => window.setTimeout(resolve, i === 0 ? 180 : 420));
    }
    setAnimatingBattle(false);
  }, [battlePreview]);

  const resolveBattle = useCallback(async () => {
    if (!currentMatchId || !roomModel.canStartBattle) return;
    setPending('battle');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::start_battle`,
        arguments: [tx.object(currentMatchId), tx.object(TREASURY_ID), tx.object(CLOCK_ID)],
      });
      await execute(tx, 'Battle resolved');
      await playFrames();
      await loadMatch(currentMatchId, 'battle');
    } finally {
      setPending(null);
    }
  }, [currentMatchId, execute, loadMatch, playFrames, roomModel.canStartBattle]);

  const handleDefend = useCallback(() => {
    toast.message('Shield up!');
  }, []);

  const handleEmote = useCallback(() => {
    toast.message('Your legend roars!');
  }, []);

  const handleBackLobby = useCallback(() => {
    setScreen('lobby');
  }, []);

  const handleOpenBattle = useCallback(() => {
    setScreen('battle');
  }, []);

  const liveMatches = useMemo(
    () => arenaMatches.activeMatches.filter((match) => match.objectId !== currentMatchId).slice(0, 6),
    [arenaMatches.activeMatches, currentMatchId]
  );

  const playerList = useMemo(
    () => lobby.players.filter((player) => player.address !== account?.address),
    [account?.address, lobby.players]
  );

  if (!account) {
    return (
      <PageShell title="Arena" subtitle="Connect your Sui wallet to battle.">
        <div className="space-y-4">
          <section className="glass-card space-y-4 p-5 sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan/80">Anavrin Legends</div>
            <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Battle Arena</h2>
            <p className="max-w-2xl text-sm leading-6 text-gray-300">
              Connect your wallet to see trainers online, pick your legend, and jump into battle rooms.
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="glass-card space-y-3 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">1. Lobby</div>
              <div className="text-2xl font-black text-white">See trainers online</div>
              <div className="rounded-[22px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
                Invite a player or accept their challenge.
              </div>
            </section>
            <section className="glass-card space-y-3 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">2. Room</div>
              <div className="text-2xl font-black text-white">Load legends and ready up</div>
              <div className="rounded-[22px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
                Deposit NFTs, set wager, and glow READY when both sides are loaded.
              </div>
            </section>
            <section className="glass-card space-y-3 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">3. Battle</div>
              <div className="text-2xl font-black text-white">Big buttons. Fast fight.</div>
              <div className="rounded-[22px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
                ATTACK, SPECIAL, DEFEND, and EMOTE with a giant arena view.
              </div>
            </section>
          </div>
        </div>
      </PageShell>
    );
  }

  const loading = walletMonsters.isLoading || arenaMatches.isLoading;

  return (
    <PageShell title="Arena" subtitle="Invite. Deposit. Ready. Battle.">
      <div className="flex flex-wrap gap-2">
        {(['lobby', 'room', 'battle'] as ArenaScreen[]).map((step) => (
          <button
            key={step}
            className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.14em] ${screen === step ? 'bg-purple text-white' : 'border border-borderSoft bg-black/20 text-gray-300'}`}
            onClick={() => setScreen(step)}
            disabled={step !== 'lobby' && !currentMatchId}
          >
            {step}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid count={3} />
      ) : screen === 'lobby' ? (
        <LobbyScreen
          players={playerList}
          invites={lobby.invites.filter((invite) => invite.to === account.address && invite.status === 'pending')}
          openMatches={lobby.openMatches.filter((match) => match.creator !== account.address)}
          liveMatches={liveMatches}
          selectedMonsterId={selectedMonster?.objectId ?? ''}
          monsters={monsters}
          pending={pending}
          onPickMonster={setSelectedMonsterId}
          onInvite={handleInvite}
          onAcceptInvite={handleAcceptInvite}
          onJoinOpenMatch={handleJoinOpenMatch}
          onWatchMatch={(matchId) => {
            void loadMatch(matchId, 'battle');
          }}
        />
      ) : screen === 'room' ? (
        <BattleRoomScreen
          accountAddress={account.address}
          match={activeMatch}
          currentMatchId={currentMatchId}
          resolution={resolution}
          roomParticipants={room.participants}
          roomNotices={room.notices}
          roomModel={roomModel}
          selectedMonsterId={selectedMonster?.objectId ?? ''}
          monsters={monsters}
          selectedStake={selectedStake}
          playerAMonster={playerAMonster}
          playerBMonster={playerBMonster}
          pending={pending}
          onPickMonster={setSelectedMonsterId}
          onPickStake={setSelectedStake}
          onDeposit={handleDeposit}
          onWithdraw={handleWithdraw}
          onToggleReady={handleToggleReady}
          onOpenBattle={handleOpenBattle}
          onBackLobby={handleBackLobby}
        />
      ) : (
        <BattleArenaScreen
          match={activeMatch}
          resolution={resolution}
          preview={battlePreview}
          frameIndex={frameIndex}
          animating={animatingBattle}
          canAttack={roomModel.canStartBattle && !resolution && pending === null}
          pending={pending}
          accountAddress={account.address}
          spectator={!activeMatch || (activeMatch.player_a !== account.address && activeMatch.player_b !== account.address)}
          onAttack={resolveBattle}
          onSpecial={resolveBattle}
          onDefend={handleDefend}
          onEmote={handleEmote}
          onBackRoom={() => setScreen('room')}
          onBackLobby={handleBackLobby}
        />
      )}
    </PageShell>
  );
}
