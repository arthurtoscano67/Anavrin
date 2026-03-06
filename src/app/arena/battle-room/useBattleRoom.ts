import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useArenaPresence } from '../network/useArenaPresence';
import { buildBattleRoomViewModel } from '../battle-engine/battleEngine';
import { useArenaMatches } from '../../hooks/useArenaMatches';
import { useAnavrinData } from '../../hooks/useAnavrinData';
import { useTxExecutor } from '../../hooks/useTxExecutor';
import { fetchArenaMatch, fetchMatchResolution, queryAllEvents } from '../../lib/sui';
import { ARENA_MATCH_TYPE, CLOCK_ID, MODULE, PACKAGE_ID, TREASURY_ID } from '../../lib/constants';
import { short, toMist } from '../../lib/format';
import type { ArenaMatch, BattleOutcomeEvent, MatchResolution, Monster } from '../../lib/types';
import type { LobbyInvite, LobbyOpenMatch } from '../network/useArenaPresence';

const ACTIVE_ARENA_MATCH_STORAGE_KEY = 'activeArenaMatch';

export type ArenaSection = 'lobby' | 'setup' | 'room' | 'live' | 'history';

function includesPlayer(match: ArenaMatch, address?: string | null): boolean {
  if (!address) return false;
  return match.player_a === address || match.player_b === address;
}

function preferMatch(matches: ArenaMatch[]): ArenaMatch | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => Number(b.created_at) - Number(a.created_at));
  const active = sorted.find((match) => match.status === 0 || match.status === 1);
  if (active) return active;
  const finished = sorted.find((match) => match.status === 2);
  if (finished) return finished;
  return sorted[0] ?? null;
}

function isValidSuiAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]{2,}$/.test(input.trim());
}

export function useBattleRoom() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [params, setParams] = useSearchParams();
  const { walletMonsters, recentMatches } = useAnavrinData();
  const arenaMatches = useArenaMatches(account?.address);
  const { execute, executeAndFetchBlock } = useTxExecutor();

  const [opponent, setOpponent] = useState('');
  const [createMonsterId, setCreateMonsterId] = useState('');
  const [createStake, setCreateStake] = useState('0');
  const [joinMatchId, setJoinMatchId] = useState(params.get('match') ?? '');
  const [joinMonsterId, setJoinMonsterId] = useState(params.get('monster') ?? '');
  const [joinStake, setJoinStake] = useState('0');
  const [activeMatch, setActiveMatch] = useState<ArenaMatch | null>(null);
  const [resolution, setResolution] = useState<MatchResolution | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [handledLobbyStartId, setHandledLobbyStartId] = useState<string | null>(null);
  const [recoveringMatch, setRecoveringMatch] = useState(false);
  const [mobileSection, setMobileSection] = useState<ArenaSection>('lobby');

  useEffect(() => {
    const matchId = params.get('match');
    const monsterFromUrl = params.get('monster');
    if (matchId) setJoinMatchId(matchId);
    if (monsterFromUrl) {
      if (!joinMonsterId) setJoinMonsterId(monsterFromUrl);
      if (!createMonsterId) setCreateMonsterId(monsterFromUrl);
    }
  }, [createMonsterId, joinMonsterId, params]);

  useEffect(() => {
    if (walletMonsters.data?.[0] && !createMonsterId) {
      setCreateMonsterId(walletMonsters.data[0].objectId);
    }
  }, [createMonsterId, walletMonsters.data]);

  useEffect(() => {
    if (walletMonsters.data?.[0] && !joinMonsterId) {
      setJoinMonsterId(walletMonsters.data[0].objectId);
    }
  }, [joinMonsterId, walletMonsters.data]);

  const currentMatchId = joinMatchId.trim();
  const urlMatchId = params.get('match')?.trim() ?? '';

  const selectedPresenceMonster = useMemo(
    () => (walletMonsters.data ?? []).find((monster) => monster.objectId === createMonsterId) ?? (walletMonsters.data ?? [])[0],
    [createMonsterId, walletMonsters.data]
  );

  const selectedArenaMonsterId = currentMatchId ? joinMonsterId : createMonsterId;
  const selectedArenaMonster = useMemo(
    () => (walletMonsters.data ?? []).find((monster) => monster.objectId === selectedArenaMonsterId) ?? null,
    [selectedArenaMonsterId, walletMonsters.data]
  );

  const presence = useArenaPresence({
    enabled: Boolean(account?.address),
    address: account?.address,
    monsterName: selectedPresenceMonster?.name ?? 'Unknown',
    level: Math.max(1, (selectedPresenceMonster?.stage ?? 0) + 1),
  });

  const setMatchContext = useCallback((match: ArenaMatch | null) => {
    setActiveMatch(match);
    if (!match || !account?.address) return;
    if (!includesPlayer(match, account.address)) return;
    const opponentAddress = match.player_a === account.address ? match.player_b : match.player_a;
    if (opponentAddress) setOpponent(opponentAddress);
  }, [account?.address]);

  const persistActiveMatchId = useCallback((matchId?: string | null) => {
    if (typeof window === 'undefined') return;
    if (matchId) {
      window.localStorage.setItem(ACTIVE_ARENA_MATCH_STORAGE_KEY, matchId);
      return;
    }
    window.localStorage.removeItem(ACTIVE_ARENA_MATCH_STORAGE_KEY);
  }, []);

  const loadMatch = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setPending('load');
    try {
      const [match, matchResolution] = await Promise.all([
        fetchArenaMatch(client, matchId),
        fetchMatchResolution(client, matchId),
      ]);
      setMatchContext(match);
      setResolution(matchResolution);
      persistActiveMatchId(match?.objectId ?? null);
    } catch (error) {
      setMatchContext(null);
      setResolution(null);
      toast.error(error instanceof Error ? error.message : 'Unable to load match');
    } finally {
      setPending(null);
    }
  }, [client, persistActiveMatchId, setMatchContext]);

  const upsertMatchQueryParam = useCallback((matchId: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('match', matchId);
      return next;
    });
  }, [setParams]);

  useEffect(() => {
    if (!account?.address) {
      setRecoveringMatch(false);
      setMatchContext(null);
      setResolution(null);
      return;
    }

    let cancelled = false;
    const recoverArenaState = async () => {
      setRecoveringMatch(true);
      try {
        const address = account.address;
        const byPriority = new Map<string, number>();
        if (urlMatchId) byPriority.set(urlMatchId, Number.MAX_SAFE_INTEGER);

        if (typeof window !== 'undefined') {
          const storedMatchId = window.localStorage.getItem(ACTIVE_ARENA_MATCH_STORAGE_KEY)?.trim();
          if (storedMatchId) byPriority.set(storedMatchId, Number.MAX_SAFE_INTEGER - 1);
        }

        const createdEvents = await queryAllEvents(client, `${PACKAGE_ID}::${MODULE}::MatchCreated`);
        for (const event of createdEvents) {
          const parsed = event.parsedJson as Record<string, unknown> | null;
          if (!parsed) continue;
          const playerA = String(parsed.player_a ?? '');
          const playerB = String(parsed.player_b ?? '');
          if (playerA !== address && playerB !== address) continue;
          const matchId = String(parsed.match_id ?? '');
          if (!matchId) continue;
          byPriority.set(matchId, Number(event.timestampMs ?? 0));
        }

        const candidateIds = [...byPriority.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
        if (candidateIds.length === 0) {
          if (!cancelled) {
            setMatchContext(null);
            setResolution(null);
            persistActiveMatchId(null);
          }
          return;
        }

        const hydratedMatches = (await Promise.all(candidateIds.map(async (id) => {
          try {
            return await fetchArenaMatch(client, id);
          } catch {
            return null;
          }
        })))
          .filter((match): match is ArenaMatch => Boolean(match))
          .filter((match) => includesPlayer(match, address));

        const recovered = preferMatch(hydratedMatches);
        if (!cancelled && recovered) {
          setJoinMatchId(recovered.objectId);
          upsertMatchQueryParam(recovered.objectId);
          persistActiveMatchId(recovered.objectId);
          setMatchContext(recovered);
          const recoveredResolution = await fetchMatchResolution(client, recovered.objectId);
          if (!cancelled) {
            setResolution(recoveredResolution);
          }
          return;
        }

        if (!cancelled) {
          setMatchContext(null);
          setResolution(null);
          persistActiveMatchId(null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to recover arena match');
        }
      } finally {
        if (!cancelled) setRecoveringMatch(false);
      }
    };

    void recoverArenaState();
    return () => {
      cancelled = true;
    };
  }, [account?.address, client, persistActiveMatchId, setMatchContext, upsertMatchQueryParam, urlMatchId]);

  useEffect(() => {
    if (!account?.address) return;
    const started = presence.pendingMatchStart;
    if (!started) return;
    if (handledLobbyStartId === started.id) return;
    if (started.from !== account.address && started.to !== account.address) return;

    const opponentAddress = started.from === account.address ? started.to : started.from;
    setOpponent(opponentAddress);

    if (started.matchId) {
      setJoinMatchId(started.matchId);
      upsertMatchQueryParam(started.matchId);
      void loadMatch(started.matchId);
      toast.success(`Lobby match ready with ${short(opponentAddress)}. Deposit your legend now.`);
      presence.clearPendingMatchStart();
    } else {
      toast.message(`Invite accepted with ${short(opponentAddress)}. Waiting for on-chain room...`);
    }
    setHandledLobbyStartId(started.id);
  }, [account?.address, handledLobbyStartId, loadMatch, presence, upsertMatchQueryParam]);

  const onCreateMatch = useCallback(async () => {
    if (!account) {
      toast.error('Connect wallet first');
      return;
    }
    if (!isValidSuiAddress(opponent)) {
      toast.error('Enter a valid opponent wallet address');
      return;
    }
    if (!createMonsterId) {
      toast.error('Select a monster to send');
      return;
    }

    setPending('create');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::create_match`,
        arguments: [tx.pure.address(opponent.trim()), tx.object(CLOCK_ID)],
      });

      const { block } = await executeAndFetchBlock(tx, 'Match created');
      const created = block.objectChanges?.find((c) => c.type === 'created' && c.objectType === ARENA_MATCH_TYPE);
      if (!created || !('objectId' in created)) {
        throw new Error('Could not parse new match id from transaction');
      }

      const createdMatchId = created.objectId;
      setJoinMatchId(createdMatchId);
      upsertMatchQueryParam(createdMatchId);
      persistActiveMatchId(createdMatchId);

      const setupTx = new Transaction();
      setupTx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::deposit_monster`,
        arguments: [setupTx.object(createdMatchId), setupTx.object(createMonsterId), setupTx.object(CLOCK_ID)],
      });

      const stakeMist = toMist(createStake || '0');
      if (stakeMist > 0n) {
        const [stakeCoin] = setupTx.splitCoins(setupTx.gas, [setupTx.pure.u64(stakeMist)]);
        setupTx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::deposit_stake`,
          arguments: [setupTx.object(createdMatchId), stakeCoin, setupTx.object(CLOCK_ID)],
        });
      }

      await execute(setupTx, 'Monster deposited into new match');
      presence.announceMatchCreated({
        matchId: createdMatchId,
        opponent: opponent.trim(),
        stakeSui: createStake || '0',
      });
      await walletMonsters.refetch();
      await loadMatch(createdMatchId);
    } finally {
      setPending(null);
    }
  }, [account, createMonsterId, createStake, execute, executeAndFetchBlock, loadMatch, opponent, persistActiveMatchId, presence, upsertMatchQueryParam, walletMonsters]);

  const onDepositLegend = useCallback(async () => {
    if (!account) {
      toast.error('Connect wallet first');
      return;
    }
    if (!currentMatchId) {
      toast.error('Enter a match object id');
      return;
    }
    if (!joinMonsterId) {
      toast.error('Select a monster');
      return;
    }

    setPending('join');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::deposit_monster`,
        arguments: [tx.object(currentMatchId), tx.object(joinMonsterId), tx.object(CLOCK_ID)],
      });

      const stakeMist = toMist(joinStake || '0');
      if (stakeMist > 0n) {
        const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(stakeMist)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::deposit_stake`,
          arguments: [tx.object(currentMatchId), stakeCoin, tx.object(CLOCK_ID)],
        });
      }

      await execute(tx, 'Match deposit complete');
      upsertMatchQueryParam(currentMatchId);
      persistActiveMatchId(currentMatchId);
      await walletMonsters.refetch();
      await loadMatch(currentMatchId);
    } finally {
      setPending(null);
    }
  }, [account, currentMatchId, execute, joinMonsterId, joinStake, loadMatch, persistActiveMatchId, upsertMatchQueryParam, walletMonsters]);

  const onStartBattle = useCallback(async () => {
    if (!currentMatchId) {
      toast.error('Load a match first');
      return;
    }

    setPending('battle');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::start_battle`,
        arguments: [tx.object(currentMatchId), tx.object(TREASURY_ID), tx.object(CLOCK_ID)],
      });

      const { block } = await executeAndFetchBlock(tx, 'Battle resolved');
      const matchEvent = block.events?.find((evt) => evt.type === `${PACKAGE_ID}::${MODULE}::MatchFinished`);
      const battleEvent = block.events?.find((evt) => evt.type === `${PACKAGE_ID}::${MODULE}::BattleOutcome`);

      if (matchEvent?.parsedJson) {
        const parsed = matchEvent.parsedJson as Record<string, unknown>;
        const parsedBattle = battleEvent?.parsedJson as Record<string, unknown> | undefined;
        const battleOutcome: BattleOutcomeEvent | undefined = parsedBattle
          ? {
              winner_id: String(parsedBattle.winner_id ?? ''),
              loser_id: String(parsedBattle.loser_id ?? ''),
              winner_wins: String(parsedBattle.winner_wins ?? '0'),
              loser_losses: String(parsedBattle.loser_losses ?? '0'),
              winner_xp: String(parsedBattle.winner_xp ?? '0'),
              loser_xp: String(parsedBattle.loser_xp ?? '0'),
              loser_scars: String(parsedBattle.loser_scars ?? '0'),
              loser_broken_horns: String(parsedBattle.loser_broken_horns ?? '0'),
              loser_torn_wings: String(parsedBattle.loser_torn_wings ?? '0'),
              timestampMs: String(Date.now()),
            }
          : undefined;

        setResolution({
          matchId: String(parsed.match_id ?? currentMatchId),
          winner: String(parsed.winner ?? ''),
          winnerMonsterId: String(parsed.winner_monster_id ?? ''),
          loserMonsterId: String(parsed.loser_monster_id ?? ''),
          totalPayoutMist: String(parsed.total_payout_mist ?? '0'),
          feeMist: String(parsed.fee_mist ?? '0'),
          txDigest: block.digest,
          timestampMs: String(Date.now()),
          battleOutcome,
        });
      }

      await loadMatch(currentMatchId);
    } finally {
      setPending(null);
    }
  }, [currentMatchId, executeAndFetchBlock, loadMatch]);

  const onWithdraw = useCallback(async () => {
    if (!currentMatchId) {
      toast.error('Load a match first');
      return;
    }

    setPending('withdraw');
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::withdraw`,
        arguments: [tx.object(currentMatchId)],
      });
      await execute(tx, 'Withdraw complete');
      await walletMonsters.refetch();
      await loadMatch(currentMatchId);
    } finally {
      setPending(null);
    }
  }, [currentMatchId, execute, loadMatch, walletMonsters]);

  const onInvitePlayer = useCallback((to: string) => {
    setOpponent(to);
    setMobileSection('setup');
    presence.invitePlayer(to);
    toast.success(`Invite sent to ${short(to)}`);
  }, [presence]);

  const onCreateOpenLobbyMatch = useCallback((stakeSui: string) => {
    if (!account) {
      toast.error('Connect wallet first');
      return;
    }
    if (!createMonsterId) {
      toast.error('Select a monster first');
      return;
    }
    presence.createOpenMatch(stakeSui);
    setCreateStake(stakeSui);
    toast.success('Open lobby match posted');
  }, [account, createMonsterId, presence]);

  const onJoinOpenLobbyMatch = useCallback((match: LobbyOpenMatch) => {
    if (!account) {
      toast.error('Connect wallet first');
      return;
    }
    if (!createMonsterId) {
      toast.error('Select a monster first');
      return;
    }
    setOpponent(match.creator);
    setCreateStake(match.stakeSui || '0');
    setJoinStake(match.stakeSui || '0');
    setMobileSection('setup');
    presence.joinOpenMatch(match.id, match.creator);
    toast.success(`Challenge accepted: ${short(match.creator)}`);
  }, [account, createMonsterId, presence]);

  const onAcceptLobbyInvite = useCallback((invite: LobbyInvite) => {
    setOpponent(invite.from);
    setMobileSection('setup');
    presence.acceptInvite(invite);
    toast.success(`Invite accepted: ${short(invite.from)}`);
  }, [presence]);

  const onResetArenaFlow = useCallback(() => {
    setOpponent('');
    setJoinMatchId('');
    setJoinStake('0');
    setCreateStake('0');
    setActiveMatch(null);
    setResolution(null);
    setHandledLobbyStartId(null);
    presence.clearPendingMatchStart();
    persistActiveMatchId(null);
    setMobileSection('lobby');
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('match');
      next.delete('monster');
      return next;
    });
    toast.message('Arena flow reset. Pick your next move.');
  }, [persistActiveMatchId, presence, setParams]);

  const setArenaMonster = useCallback((monsterId: string) => {
    setCreateMonsterId(monsterId);
    setJoinMonsterId(monsterId);
  }, []);

  const setArenaStake = useCallback((stake: string) => {
    setCreateStake(stake);
    setJoinStake(stake);
  }, []);

  const awaitingRoomCreation = Boolean(
    presence.pendingMatchStart &&
    !presence.pendingMatchStart.matchId &&
    account &&
    (account.address === presence.pendingMatchStart.from || account.address === presence.pendingMatchStart.to)
  );

  useEffect(() => {
    if (awaitingRoomCreation || activeMatch || currentMatchId) {
      setMobileSection('room');
      return;
    }
    setMobileSection((current) => (current === 'room' ? 'lobby' : current));
  }, [activeMatch, awaitingRoomCreation, currentMatchId]);

  const incomingInviteCount = presence.invites.filter(
    (invite) => invite.to === account?.address && invite.status === 'pending'
  ).length;

  const room = useMemo(() => buildBattleRoomViewModel({
    match: activeMatch,
    resolution,
    accountAddress: account?.address,
    awaitingRoomCreation,
    recoveringMatch,
    opponentAddress: opponent,
    incomingInviteCount,
  }), [account?.address, activeMatch, awaitingRoomCreation, incomingInviteCount, opponent, recoveringMatch, resolution]);

  const canOpenRoom = Boolean(
    account &&
    opponent.trim() &&
    createMonsterId &&
    !activeMatch &&
    !awaitingRoomCreation
  );

  const selectedArenaStake = currentMatchId ? joinStake : createStake;
  const selectedStakeValue = Number(selectedArenaStake || '0');
  const selectedStakeLabel = Number.isFinite(selectedStakeValue) ? selectedStakeValue.toFixed(2) : '0.00';
  const inviteUrl = useMemo(() => {
    if (!currentMatchId || typeof window === 'undefined') return '';
    return `${window.location.origin}/arena?match=${currentMatchId}`;
  }, [currentMatchId]);

  const liveBattles = useMemo(
    () => arenaMatches.activeMatches.filter((match) => match.objectId !== activeMatch?.objectId).slice(0, 8),
    [activeMatch?.objectId, arenaMatches.activeMatches]
  );

  const recentFeed = useMemo(() => {
    const chainEvents = (recentMatches.data ?? []).slice(0, 6).map((match) => ({
      id: match.objectId,
      summary: `${short(match.player_a)} vs ${short(match.player_b)} • ${match.status === 2 ? 'Finished' : match.status === 1 ? 'Locked' : 'Waiting'}`,
      ts: Number(match.created_at || '0'),
      onChain: true,
      matchId: match.objectId,
    }));
    const lobbyEvents = presence.recentMatches.slice(0, 6).map((event) => ({
      id: event.id,
      summary: event.summary,
      ts: Number(event.timestamp || 0),
      onChain: false,
      matchId: '',
    }));
    return [...chainEvents, ...lobbyEvents].sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [presence.recentMatches, recentMatches.data]);

  return {
    account,
    walletMonsters,
    arenaMatches,
    recentMatches,
    presence,
    mobileSection,
    setMobileSection,
    opponent,
    setOpponent,
    currentMatchId,
    activeMatch,
    resolution,
    pending,
    recoveringMatch,
    selectedArenaMonster,
    selectedArenaMonsterId,
    selectedArenaStake,
    selectedStakeLabel,
    inviteUrl,
    canOpenRoom,
    liveBattles,
    recentFeed,
    room,
    loadMatch,
    setArenaMonster,
    setArenaStake,
    onCreateMatch,
    onDepositLegend,
    onStartBattle,
    onWithdraw,
    onInvitePlayer,
    onCreateOpenLobbyMatch,
    onJoinOpenLobbyMatch,
    onAcceptLobbyInvite,
    onResetArenaFlow,
  };
}
