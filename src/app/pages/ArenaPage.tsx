import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ArenaLobby } from "../../components/ArenaLobby";
import type { LobbyInvite, LobbyOpenMatch } from "../../hooks/useLobby";
import { useLobby } from "../../hooks/useLobby";

import { BattleArena } from "../components/BattleArena";
import { LoadingGrid } from "../components/LoadingGrid";
import { PageShell } from "../components/PageShell";
import { Spinner } from "../components/Spinner";
import { useArenaMatches } from "../hooks/useArenaMatches";
import {
  ARENA_MATCH_TYPE,
  CLOCK_ID,
  MODULE,
  PACKAGE_ID,
  TREASURY_ID,
} from "../lib/constants";
import { short, statusLabel, toMist, toSui } from "../lib/format";
import { fetchArenaMatch, fetchMatchResolution, queryAllEvents } from "../lib/sui";
import type { ArenaMatch, BattleOutcomeEvent, MatchResolution } from "../lib/types";
import { useAnavrinData } from "../hooks/useAnavrinData";
import { useTxExecutor } from "../hooks/useTxExecutor";

const ACTIVE_ARENA_MATCH_STORAGE_KEY = "activeArenaMatch";

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

export function ArenaPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [params, setParams] = useSearchParams();
  const { walletMonsters, recentMatches } = useAnavrinData();
  const arenaMatches = useArenaMatches(account?.address);
  const { execute, executeAndFetchBlock } = useTxExecutor();

  const [opponent, setOpponent] = useState("");
  const [createMonsterId, setCreateMonsterId] = useState("");
  const [createStake, setCreateStake] = useState("");

  const [joinMatchId, setJoinMatchId] = useState(params.get("match") ?? "");
  const [joinMonsterId, setJoinMonsterId] = useState(params.get("monster") ?? "");
  const [joinStake, setJoinStake] = useState("");

  const [activeMatch, setActiveMatch] = useState<ArenaMatch | null>(null);
  const [resolution, setResolution] = useState<MatchResolution | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [handledLobbyStartId, setHandledLobbyStartId] = useState<string | null>(null);
  const [recoveringMatch, setRecoveringMatch] = useState(false);
  const lobbySectionRef = useRef<HTMLDivElement | null>(null);
  const roomSectionRef = useRef<HTMLDivElement | null>(null);
  const liveSectionRef = useRef<HTMLDivElement | null>(null);
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const m = params.get("match");
    const monsterFromUrl = params.get("monster");
    if (m) setJoinMatchId(m);
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
  const urlMatchId = params.get("match")?.trim() ?? "";

  const selectedMonster = useMemo(
    () =>
      (walletMonsters.data ?? []).find((monster) => monster.objectId === createMonsterId) ??
      (walletMonsters.data ?? [])[0],
    [createMonsterId, walletMonsters.data]
  );

  const lobby = useLobby({
    enabled: Boolean(account?.address),
    address: account?.address,
    monsterName: selectedMonster?.name ?? "Unknown",
    level: Math.max(1, (selectedMonster?.stage ?? 0) + 1),
  });
  const pendingMatchStart = lobby.pendingMatchStart;
  const clearPendingMatchStart = lobby.clearPendingMatchStart;

  const setMatchContext = useCallback((match: ArenaMatch | null) => {
    setActiveMatch(match);
    if (!match || !account?.address) return;
    if (!includesPlayer(match, account.address)) return;
    const opponentAddress = match.player_a === account.address ? match.player_b : match.player_a;
    if (opponentAddress) setOpponent(opponentAddress);
  }, [account?.address]);

  const persistActiveMatchId = useCallback((matchId?: string | null) => {
    if (typeof window === "undefined") return;
    if (matchId) {
      window.localStorage.setItem(ACTIVE_ARENA_MATCH_STORAGE_KEY, matchId);
      return;
    }
    window.localStorage.removeItem(ACTIVE_ARENA_MATCH_STORAGE_KEY);
  }, []);

  const loadMatch = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setPending("load");
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
      toast.error(error instanceof Error ? error.message : "Unable to load match");
    } finally {
      setPending(null);
    }
  }, [client, persistActiveMatchId, setMatchContext]);

  const upsertMatchQueryParam = useCallback((matchId: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("match", matchId);
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

        if (typeof window !== "undefined") {
          const storedMatchId = window.localStorage
            .getItem(ACTIVE_ARENA_MATCH_STORAGE_KEY)
            ?.trim();
          if (storedMatchId) {
            byPriority.set(storedMatchId, Number.MAX_SAFE_INTEGER - 1);
          }
        }

        const createdEvents = await queryAllEvents(
          client,
          `${PACKAGE_ID}::${MODULE}::MatchCreated`
        );

        for (const event of createdEvents) {
          const parsed = event.parsedJson as Record<string, unknown> | null;
          if (!parsed) continue;
          const playerA = String(parsed.player_a ?? "");
          const playerB = String(parsed.player_b ?? "");
          if (playerA !== address && playerB !== address) continue;
          const matchId = String(parsed.match_id ?? "");
          if (!matchId) continue;
          byPriority.set(matchId, Number(event.timestampMs ?? 0));
        }

        const candidateIds = [...byPriority.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => id);

        if (candidateIds.length === 0) {
          if (!cancelled) {
            setMatchContext(null);
            setResolution(null);
            persistActiveMatchId(null);
          }
          return;
        }

        const hydratedMatches = (await Promise.all(
          candidateIds.map(async (id) => {
            try {
              return await fetchArenaMatch(client, id);
            } catch {
              return null;
            }
          })
        ))
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
          toast.error(error instanceof Error ? error.message : "Failed to recover arena match");
        }
      } finally {
        if (!cancelled) {
          setRecoveringMatch(false);
        }
      }
    };

    void recoverArenaState();
    return () => {
      cancelled = true;
    };
  }, [account?.address, client, persistActiveMatchId, setMatchContext, upsertMatchQueryParam, urlMatchId]);

  useEffect(() => {
    if (!account?.address) return;
    const started = pendingMatchStart;
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
      clearPendingMatchStart();
    } else {
      toast.message(`Invite accepted with ${short(opponentAddress)}. Waiting for on-chain match room...`);
    }
    setHandledLobbyStartId(started.id);
  }, [
    account?.address,
    clearPendingMatchStart,
    handledLobbyStartId,
    loadMatch,
    pendingMatchStart,
    upsertMatchQueryParam,
  ]);

  const onCreateMatch = async () => {
    if (!account) {
      toast.error("Connect wallet first");
      return;
    }
    if (!isValidSuiAddress(opponent)) {
      toast.error("Enter a valid opponent wallet address");
      return;
    }
    if (!createMonsterId) {
      toast.error("Select a monster to send");
      return;
    }

    setPending("create");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::create_match`,
        arguments: [tx.pure.address(opponent.trim()), tx.object(CLOCK_ID)],
      });

      const { block } = await executeAndFetchBlock(tx, "Match created");
      const created = block.objectChanges?.find(
        (c) => c.type === "created" && c.objectType === ARENA_MATCH_TYPE
      );

      if (!created || !("objectId" in created)) {
        throw new Error("Could not parse new match id from transaction");
      }

      const createdMatchId = created.objectId;
      setJoinMatchId(createdMatchId);
      upsertMatchQueryParam(createdMatchId);
      persistActiveMatchId(createdMatchId);

      const setupTx = new Transaction();
      setupTx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::deposit_monster`,
        arguments: [
          setupTx.object(createdMatchId),
          setupTx.object(createMonsterId),
          setupTx.object(CLOCK_ID),
        ],
      });

      const stakeMist = toMist(createStake || "0");
      if (stakeMist > 0n) {
        const [stakeCoin] = setupTx.splitCoins(setupTx.gas, [setupTx.pure.u64(stakeMist)]);
        setupTx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::deposit_stake`,
          arguments: [setupTx.object(createdMatchId), stakeCoin, setupTx.object(CLOCK_ID)],
        });
      }

      await execute(setupTx, "Monster deposited into new match");
      lobby.announceMatchCreated({
        matchId: createdMatchId,
        opponent: opponent.trim(),
        stakeSui: createStake || "0",
      });
      await walletMonsters.refetch();
      await loadMatch(createdMatchId);
    } finally {
      setPending(null);
    }
  };

  const onJoinMatch = async () => {
    if (!account) {
      toast.error("Connect wallet first");
      return;
    }
    if (!currentMatchId) {
      toast.error("Enter a match object id");
      return;
    }
    if (!joinMonsterId) {
      toast.error("Select a monster");
      return;
    }

    setPending("join");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::deposit_monster`,
        arguments: [tx.object(currentMatchId), tx.object(joinMonsterId), tx.object(CLOCK_ID)],
      });

      const stakeMist = toMist(joinStake || "0");
      if (stakeMist > 0n) {
        const [stakeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(stakeMist)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE}::deposit_stake`,
          arguments: [tx.object(currentMatchId), stakeCoin, tx.object(CLOCK_ID)],
        });
      }

      await execute(tx, "Match deposit complete");
      upsertMatchQueryParam(currentMatchId);
      persistActiveMatchId(currentMatchId);
      await walletMonsters.refetch();
      await loadMatch(currentMatchId);
    } finally {
      setPending(null);
    }
  };

  const onStartBattle = async () => {
    if (!currentMatchId) {
      toast.error("Load a match first");
      return;
    }

    setPending("battle");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::start_battle`,
        arguments: [tx.object(currentMatchId), tx.object(TREASURY_ID), tx.object(CLOCK_ID)],
      });

      const { block } = await executeAndFetchBlock(tx, "Battle resolved");
      const matchEvent = block.events?.find(
        (evt) => evt.type === `${PACKAGE_ID}::${MODULE}::MatchFinished`
      );
      const battleEvent = block.events?.find(
        (evt) => evt.type === `${PACKAGE_ID}::${MODULE}::BattleOutcome`
      );

      if (matchEvent?.parsedJson) {
        const parsed = matchEvent.parsedJson as Record<string, unknown>;
        const parsedBattle = battleEvent?.parsedJson as Record<string, unknown> | undefined;
        const battleOutcome: BattleOutcomeEvent | undefined = parsedBattle
          ? {
              winner_id: String(parsedBattle.winner_id ?? ""),
              loser_id: String(parsedBattle.loser_id ?? ""),
              winner_wins: String(parsedBattle.winner_wins ?? "0"),
              loser_losses: String(parsedBattle.loser_losses ?? "0"),
              winner_xp: String(parsedBattle.winner_xp ?? "0"),
              loser_xp: String(parsedBattle.loser_xp ?? "0"),
              loser_scars: String(parsedBattle.loser_scars ?? "0"),
              loser_broken_horns: String(parsedBattle.loser_broken_horns ?? "0"),
              loser_torn_wings: String(parsedBattle.loser_torn_wings ?? "0"),
              timestampMs: String(Date.now()),
            }
          : undefined;
        setResolution({
          matchId: String(parsed.match_id ?? currentMatchId),
          winner: String(parsed.winner ?? ""),
          winnerMonsterId: String(parsed.winner_monster_id ?? ""),
          loserMonsterId: String(parsed.loser_monster_id ?? ""),
          totalPayoutMist: String(parsed.total_payout_mist ?? "0"),
          feeMist: String(parsed.fee_mist ?? "0"),
          txDigest: block.digest,
          timestampMs: String(Date.now()),
          battleOutcome,
        });
      }

      await loadMatch(currentMatchId);
    } finally {
      setPending(null);
    }
  };

  const onWithdraw = async () => {
    if (!currentMatchId) {
      toast.error("Load a match first");
      return;
    }

    setPending("withdraw");
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::withdraw`,
        arguments: [tx.object(currentMatchId)],
      });
      await execute(tx, "Withdraw complete");
      await walletMonsters.refetch();
      await loadMatch(currentMatchId);
    } finally {
      setPending(null);
    }
  };

  const inviteUrl = useMemo(() => {
    if (!currentMatchId || typeof window === "undefined") return "";
    return `${window.location.origin}/arena?match=${currentMatchId}`;
  }, [currentMatchId]);

  const onInvitePlayer = (to: string) => {
    setOpponent(to);
    lobby.invitePlayer(to);
    toast.success(`Invite sent to ${short(to)}`);
  };

  const onCreateOpenLobbyMatch = (stakeSui: string) => {
    if (!account) {
      toast.error("Connect wallet first");
      return;
    }
    if (!createMonsterId) {
      toast.error("Select a monster first");
      return;
    }
    lobby.createOpenMatch(stakeSui);
    setCreateStake(stakeSui);
    toast.success("Open lobby match posted");
  };

  const onJoinOpenLobbyMatch = (match: LobbyOpenMatch) => {
    if (!account) {
      toast.error("Connect wallet first");
      return;
    }
    if (!createMonsterId) {
      toast.error("Select a monster first");
      return;
    }
    setOpponent(match.creator);
    setCreateStake(match.stakeSui || "0");
    setJoinStake(match.stakeSui || "0");
    lobby.joinOpenMatch(match.id, match.creator);
    toast.success(`Challenge accepted: ${short(match.creator)}`);
  };

  const onAcceptLobbyInvite = (invite: LobbyInvite) => {
    setOpponent(invite.from);
    lobby.acceptInvite(invite);
    toast.success(`Invite accepted: ${short(invite.from)}`);
  };

  const onResetArenaFlow = () => {
    setOpponent("");
    setJoinMatchId("");
    setJoinStake("");
    setCreateStake("");
    setActiveMatch(null);
    setResolution(null);
    setHandledLobbyStartId(null);
    clearPendingMatchStart();
    persistActiveMatchId(null);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("match");
      next.delete("monster");
      return next;
    });
    toast.message("Arena flow reset. Pick your next move.");
  };

  const scrollToSection = useCallback((ref: RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const setArenaMonster = useCallback((monsterId: string) => {
    setCreateMonsterId(monsterId);
    setJoinMonsterId(monsterId);
  }, []);

  const setArenaStake = useCallback((stake: string) => {
    setCreateStake(stake);
    setJoinStake(stake);
  }, []);

  const canStartBattle =
    activeMatch &&
    activeMatch.status === 1 &&
    account &&
    (account.address === activeMatch.player_a || account.address === activeMatch.player_b);
  const userSide =
    activeMatch && account
      ? account.address === activeMatch.player_a
        ? "a"
        : account.address === activeMatch.player_b
          ? "b"
          : null
      : null;
  const userHasDeposited =
    activeMatch && userSide
      ? userSide === "a"
        ? Boolean(activeMatch.mon_a)
        : Boolean(activeMatch.mon_b)
      : false;
  const opponentHasDeposited =
    activeMatch && userSide
      ? userSide === "a"
        ? Boolean(activeMatch.mon_b)
        : Boolean(activeMatch.mon_a)
      : false;
  const bothDeposited = Boolean(activeMatch?.mon_a && activeMatch?.mon_b);
  const awaitingRoomCreation = Boolean(
    pendingMatchStart &&
    !pendingMatchStart.matchId &&
    account &&
    (account.address === pendingMatchStart.from || account.address === pendingMatchStart.to)
  );
  const incomingInviteCount = lobby.invites.filter(
    (invite) => invite.to === account?.address && invite.status === "pending"
  ).length;
  const isPlayerInMatch =
    activeMatch &&
    account &&
    (account.address === activeMatch.player_a || account.address === activeMatch.player_b);
  const canWithdraw =
    activeMatch &&
    activeMatch.status === 0 &&
    isPlayerInMatch;
  const lockCreateActions = Boolean(
    activeMatch &&
    isPlayerInMatch &&
    activeMatch.status !== 2 &&
    activeMatch.status !== 3
  );
  const roomStatusLabel = recoveringMatch
    ? "Syncing"
    : activeMatch
      ? statusLabel(activeMatch.status)
      : awaitingRoomCreation
        ? "Creating Room"
        : "Lobby Open";
  const arenaHeroMessage = awaitingRoomCreation
    ? "Invite accepted. Hold tight while the shared room appears on-chain."
    : !activeMatch
      ? opponent.trim()
        ? `Challenge ${short(opponent)} is lined up. Open the room and ready your legend.`
        : "Start in the Arena Lobby. Tap Invite on a trainer card or join an open room."
      : activeMatch.status === 2
        ? "Battle complete. Review the result below or jump back into the lobby."
        : activeMatch.status === 3
          ? "This room was cancelled. Everyone got their legend and stake back."
          : bothDeposited
            ? "Both legends are glowing Ready. Either trainer can press Start Battle."
            : userHasDeposited
              ? "Your legend is locked in. Waiting for the other trainer to ready up."
              : "This room is live. Deposit your legend and matching wager to enter.";
  const selectedArenaMonsterId = currentMatchId ? joinMonsterId : createMonsterId;
  const selectedArenaStake = currentMatchId ? joinStake : createStake;
  const canOpenRoom = Boolean(
    account &&
    opponent.trim() &&
    createMonsterId &&
    !activeMatch &&
    !awaitingRoomCreation &&
    !lockCreateActions
  );
  const openRoomButtonLabel = pending === "create"
    ? "Opening Room..."
    : awaitingRoomCreation
      ? "Creating Room..."
      : activeMatch
        ? "Room Ready"
        : opponent.trim()
          ? "Open Battle Room"
          : "Invite A Trainer";
  const mobileSectionButtons = [
    { id: "lobby", label: "Lobby", ref: lobbySectionRef },
    { id: "room", label: "Room", ref: roomSectionRef },
    { id: "live", label: "Live", ref: liveSectionRef },
    { id: "history", label: "History", ref: historySectionRef },
  ];

  const yourNextAction = useMemo(() => {
    if (!account) return "Connect wallet to start.";
    if (awaitingRoomCreation) return "Wait for the shared match room to be created.";
    if (!activeMatch) {
      if (!opponent.trim()) return "Invite a player from Arena Lobby or paste their wallet address.";
      return "Press Create Match to open the battle room.";
    }
    if (!isPlayerInMatch) return "You are spectating. Load your own match to play.";
    if (activeMatch.status === 2) return "Battle finished. Check result and leaderboard.";
    if (activeMatch.status === 3) return "Match cancelled. Press Back To Lobby to start again.";
    if (!userHasDeposited) return "Deposit your legend to lock your side in.";
    if (!bothDeposited) return "Wait for opponent deposit, or withdraw if they disappear.";
    if (canStartBattle) return "Tap Start Battle now.";
    return "Both ready. Waiting for someone to press Start Battle.";
  }, [
    account,
    activeMatch,
    awaitingRoomCreation,
    bothDeposited,
    canStartBattle,
    isPlayerInMatch,
    opponent,
    userHasDeposited,
  ]);

  const opponentNextAction = useMemo(() => {
    if (awaitingRoomCreation) return "Opponent accepted invite and is waiting for room creation.";
    if (!activeMatch) {
      return opponent.trim()
        ? "Opponent should accept invite and wait for match room."
        : "No opponent selected yet.";
    }
    if (activeMatch.status === 2) return "Opponent already finished this battle.";
    if (activeMatch.status === 3) return "Opponent left or match was cancelled.";
    if (!opponentHasDeposited) return "Opponent needs to deposit their legend.";
    if (!userHasDeposited) return "Opponent is ready and waiting for your deposit.";
    if (bothDeposited) return "Opponent is ready. Battle can start now.";
    return "Opponent is setting up now.";
  }, [activeMatch, awaitingRoomCreation, bothDeposited, opponent, opponentHasDeposited, userHasDeposited]);

  const liveBattles = useMemo(
    () => arenaMatches.activeMatches.filter((match) => match.objectId !== activeMatch?.objectId).slice(0, 8),
    [activeMatch?.objectId, arenaMatches.activeMatches]
  );

  const localBattleFeed = useMemo(() => {
    const chainEvents = (recentMatches.data ?? []).slice(0, 6).map((match) => ({
      id: match.objectId,
      summary: `${short(match.player_a)} vs ${short(match.player_b)} • ${statusLabel(match.status)}`,
      ts: Number(match.created_at || "0"),
      onChain: true,
      matchId: match.objectId,
    }));
    const lobbyEvents = lobby.recentMatches.slice(0, 6).map((event) => ({
      id: event.id,
      summary: event.summary,
      ts: Number(event.timestamp || 0),
      onChain: false,
      matchId: "",
    }));
    return [...chainEvents, ...lobbyEvents]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8);
  }, [lobby.recentMatches, recentMatches.data]);

  const coachSteps = useMemo(() => {
    const hasOpponent = Boolean(opponent.trim());
    return [
      {
        id: "invite",
        title: "Invite + Accept",
        icon: "📨",
        done: hasOpponent || awaitingRoomCreation || Boolean(activeMatch),
        current: !hasOpponent && !awaitingRoomCreation && !activeMatch,
        help: incomingInviteCount
          ? `You have ${incomingInviteCount} invite${incomingInviteCount > 1 ? "s" : ""} waiting in Arena Lobby.`
          : "Tap Invite in Arena Lobby or paste opponent address.",
      },
      {
        id: "room",
        title: "Create Match Room",
        icon: "🏟️",
        done: Boolean(activeMatch),
        current: (hasOpponent || awaitingRoomCreation) && !activeMatch,
        help: awaitingRoomCreation
          ? "Your invite was accepted. Waiting for the match room to appear."
          : "Create Match to open a shared battle room on-chain.",
      },
      {
        id: "deposit",
        title: "Deposit Your Legend",
        icon: "🧩",
        done: userHasDeposited,
        current: Boolean(activeMatch) && !userHasDeposited,
        help: userHasDeposited
          ? "Great! Your legend is locked in safely."
          : "Choose your legend and tap Ready Up Legend.",
      },
      {
        id: "wait",
        title: "Opponent Deposit",
        icon: "👥",
        done: bothDeposited,
        current: userHasDeposited && !bothDeposited,
        help: bothDeposited
          ? "Both legends are ready."
          : "Wait for your opponent to deposit. You can withdraw before lock if needed.",
      },
      {
        id: "battle",
        title: "Start Battle",
        icon: "⚔️",
        done: activeMatch?.status === 2,
        current: Boolean(canStartBattle),
        help: canStartBattle
          ? "Everything is ready. Tap Start Battle."
          : "Battle starts when both legends and stakes are in place.",
      },
    ];
  }, [activeMatch, awaitingRoomCreation, bothDeposited, canStartBattle, incomingInviteCount, opponent, userHasDeposited]);

  return (
    <PageShell
      title="Arena"
      subtitle="Create and join live PvP matches. Every battle settles on-chain with real staking and permanent monster progression."
    >
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 md:hidden">
        {mobileSectionButtons.map((section) => (
          <button
            key={section.id}
            className="btn-ghost min-h-11 shrink-0 rounded-full px-4 text-sm"
            onClick={() => scrollToSection(section.ref)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr] xl:items-start">
        <div className="order-1 xl:order-2" ref={lobbySectionRef}>
          <ArenaLobby
            selfAddress={account?.address}
            connectionState={lobby.connectionState}
            isConnected={lobby.isConnected}
            endpoint={lobby.endpoint}
            lastError={lobby.lastError}
            players={lobby.players}
            openMatches={lobby.openMatches}
            invites={lobby.invites}
            recentMatches={lobby.recentMatches}
            busy={pending !== null || recoveringMatch || lockCreateActions}
            onInvite={onInvitePlayer}
            onCreateOpenMatch={onCreateOpenLobbyMatch}
            onJoinOpenMatch={onJoinOpenLobbyMatch}
            onAcceptInvite={onAcceptLobbyInvite}
          />
        </div>

        <div className="order-2 space-y-4 pb-24 md:pb-0 xl:order-1">
          <div className="glass-card overflow-hidden border-purple/35 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.28),transparent_42%),linear-gradient(135deg,rgba(17,24,39,0.92),rgba(11,18,32,0.96))] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan/75">Arena Flow</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Invite. Ready up. Battle.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
                  {arenaHeroMessage}
                </p>
              </div>
              <div className="rounded-full border border-cyan/40 bg-cyan/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan">
                {roomStatusLabel}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Quick setup</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Your legend</label>
                    <select
                      className="input min-h-12"
                      value={selectedArenaMonsterId}
                      onChange={(e) => setArenaMonster(e.target.value)}
                      disabled={pending !== null || recoveringMatch || userHasDeposited}
                    >
                      <option value="">Select legend</option>
                      {(walletMonsters.data ?? []).map((monster) => (
                        <option value={monster.objectId} key={monster.objectId}>
                          {monster.name} ({short(monster.objectId)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Wager (SUI)</label>
                    <input
                      className="input min-h-12"
                      placeholder="0.0"
                      value={selectedArenaStake}
                      onChange={(e) => setArenaStake(e.target.value)}
                      disabled={pending !== null || recoveringMatch || userHasDeposited}
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-[20px] border border-white/8 bg-white/5 px-3 py-3 text-sm text-gray-300">
                  {activeMatch
                    ? "Room loaded. Ready up from the buttons below when your legend and wager look right."
                    : opponent.trim()
                      ? `Opponent locked: ${short(opponent)}`
                      : "Pick a trainer from the lobby to auto-fill the opponent."}
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  className="btn-primary min-h-14 text-base"
                  onClick={onCreateMatch}
                  disabled={!canOpenRoom || pending !== null || recoveringMatch}
                >
                  {openRoomButtonLabel}
                </button>
                <button
                  className="btn-ghost min-h-14 text-base"
                  onClick={() => scrollToSection(lobbySectionRef)}
                >
                  Browse Lobby
                </button>
              </div>
            </div>

            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
              {coachSteps.map((step) => (
                <div
                  key={step.id}
                  className={`min-w-[168px] rounded-[22px] border p-3 text-left transition ${
                    step.current
                      ? "border-cyan/50 bg-cyan/20 text-cyan shadow-[0_0_28px_rgba(6,182,212,0.14)]"
                      : step.done
                        ? "border-green-400/45 bg-green-500/15 text-green-200"
                        : "border-white/10 bg-black/20 text-gray-200"
                  }`}
                >
                  <div className="text-2xl">{step.icon}</div>
                  <div className="mt-3 text-sm font-bold">{step.title}</div>
                  <div className="mt-1 text-xs leading-5 text-gray-300">{step.help}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-cyan/35 bg-cyan/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan/80">Your next move</div>
                <div className="mt-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan/20 text-xl">🕹️</div>
                  <p className="text-sm leading-6 text-white">{yourNextAction}</p>
                </div>
              </div>
              <div className="rounded-[22px] border border-purple/35 bg-purple/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-100">Opponent status</div>
                <div className="mt-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple/20 text-xl">👀</div>
                  <p className="text-sm leading-6 text-white">{opponentNextAction}</p>
                </div>
              </div>
            </div>

            <details className="mt-4 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
              <summary className="cursor-pointer font-semibold text-white">
                Tap for simple instructions
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3">1. See a trainer in the lobby.</div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3">2. Send or accept an invite.</div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3">3. Ready up by depositing your legend.</div>
                <div className="rounded-2xl border border-white/8 bg-white/5 p-3">4. When both say Ready, start the battle.</div>
              </div>
            </details>
          </div>

          <div className="glass-card space-y-4 p-4 sm:p-5" ref={roomSectionRef}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan/80">Ready Room</div>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Battle Board</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
                  This room updates live from Sui. Both trainers can see when the other legend is ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {inviteUrl ? (
                  <button
                    className="btn-ghost text-xs"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteUrl);
                      toast.success("Invite link copied");
                    }}
                  >
                    Copy Room Link
                  </button>
                ) : null}
                <button
                  className="btn-ghost text-xs"
                  disabled={!currentMatchId || pending !== null || recoveringMatch}
                  onClick={() => loadMatch(currentMatchId)}
                >
                  {pending === "load" ? "Syncing..." : "Refresh"}
                </button>
                <button
                  className="btn-ghost text-xs"
                  onClick={onResetArenaFlow}
                  disabled={pending !== null || recoveringMatch}
                >
                  Back To Lobby
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Room</div>
                <div className="mt-2 text-lg font-bold text-white">{roomStatusLabel}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {currentMatchId ? `Match ${short(currentMatchId)}` : "No room loaded yet"}
                </div>
              </div>
              <div className="rounded-[22px] border border-cyan/25 bg-cyan/10 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-cyan/80">You</div>
                <div className="mt-2 text-lg font-bold text-white">{userHasDeposited ? "Ready" : "Not ready"}</div>
                <div className="mt-1 text-xs text-gray-300">
                  {userHasDeposited ? "Your legend and wager are locked in." : "Deposit to show Ready."}
                </div>
              </div>
              <div className="rounded-[22px] border border-purple/25 bg-purple/10 p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-purple-100">Opponent</div>
                <div className="mt-2 text-lg font-bold text-white">{opponentHasDeposited ? "Ready" : "Waiting"}</div>
                <div className="mt-1 text-xs text-gray-300">
                  {opponentHasDeposited ? "Their legend is in the room." : "They still need to deposit."}
                </div>
              </div>
            </div>

            {recoveringMatch ? (
              <div className="rounded-2xl border border-cyan/30 bg-cyan/10 px-4 py-8 text-center text-sm text-cyan">
                <span className="inline-flex items-center gap-2"><Spinner /> Syncing ArenaMatch from chain...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <BattleArena
                  match={activeMatch}
                  playerALabel={activeMatch ? `${short(activeMatch.player_a)}${account?.address === activeMatch.player_a ? " • You" : ""}` : "Player A"}
                  playerBLabel={activeMatch ? `${short(activeMatch.player_b)}${account?.address === activeMatch.player_b ? " • You" : ""}` : "Player B"}
                  onRefresh={currentMatchId ? () => loadMatch(currentMatchId) : undefined}
                  refreshing={pending === "load"}
                  isResolving={pending === "battle"}
                  winnerSide={
                    resolution && activeMatch
                      ? resolution.winner === activeMatch.player_a
                        ? "left"
                        : resolution.winner === activeMatch.player_b
                          ? "right"
                          : null
                      : null
                  }
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    className="btn-primary min-h-14 text-base"
                    onClick={onJoinMatch}
                    disabled={!account || !joinMatchId || pending !== null || recoveringMatch || userHasDeposited}
                  >
                    {pending === "join"
                      ? <span className="inline-flex items-center gap-2"><Spinner /> Readying...</span>
                      : userHasDeposited
                        ? "Legend Ready"
                        : "Ready Up Legend"}
                  </button>
                  <button
                    className="btn-secondary min-h-14 text-base"
                    onClick={onStartBattle}
                    disabled={!canStartBattle || pending !== null || recoveringMatch}
                  >
                    {pending === "battle" ? <span className="inline-flex items-center gap-2"><Spinner /> Resolving...</span> : "Start Battle"}
                  </button>
                  <button
                    className="btn-ghost min-h-14 text-base"
                    onClick={onWithdraw}
                    disabled={!canWithdraw || pending !== null || recoveringMatch}
                  >
                    {pending === "withdraw" ? <span className="inline-flex items-center gap-2"><Spinner /> Leaving...</span> : "Withdraw & Leave"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                    Wager is locked at the moment you ready up. If your opponent disappears before the room locks, use Withdraw & Leave.
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                    Anyone can load the room by ID to spectate. Battles settle on-chain and feed the leaderboard.
                  </div>
                </div>
              </div>
            )}

            {resolution && (
              <div className="rounded-[24px] border border-cyan/40 bg-cyan/10 p-4 text-sm">
                <div className="mb-2 text-xs uppercase tracking-wide text-cyan-200">Battle Result</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-gray-300">Winner</div>
                    <div className="font-semibold text-green-300">{short(resolution.winner)}</div>
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
                  {resolution.battleOutcome && (
                    <div>
                      <div className="text-xs text-gray-400">Winner XP</div>
                      <div className="font-semibold text-cyan">{resolution.battleOutcome.winner_xp}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <details className="glass-card overflow-hidden p-4 sm:p-5">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-gray-400">Advanced</div>
                  <div className="mt-1 text-xl font-bold text-white">Manual Match Tools</div>
                  <div className="mt-1 text-sm text-gray-400">
                    Use this if you want to type a wallet address or paste a room ID manually.
                  </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
                  Open Panel
                </span>
              </div>
            </summary>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <h2 className="text-lg font-bold">Create Match</h2>
                {lockCreateActions ? (
                  <div className="mt-3 rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                    You are already in an active match. Finish it or go Back To Lobby before creating a new one.
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Opponent Address</label>
                    <input
                      className="input"
                      placeholder="0x..."
                      value={opponent}
                      onChange={(e) => setOpponent(e.target.value)}
                      disabled={lockCreateActions || pending !== null || recoveringMatch}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Your Monster</label>
                    <select
                      className="input"
                      value={createMonsterId}
                      onChange={(e) => setCreateMonsterId(e.target.value)}
                      disabled={lockCreateActions || pending !== null || recoveringMatch}
                    >
                      <option value="">Select monster</option>
                      {(walletMonsters.data ?? []).map((m) => (
                        <option value={m.objectId} key={m.objectId}>
                          {m.name} ({short(m.objectId)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Optional Stake (SUI)</label>
                    <input
                      className="input"
                      placeholder="0.0"
                      value={createStake}
                      onChange={(e) => setCreateStake(e.target.value)}
                      disabled={lockCreateActions || pending !== null || recoveringMatch}
                    />
                  </div>

                  <button
                    className="btn-primary min-h-12 w-full"
                    onClick={onCreateMatch}
                    disabled={!account || pending !== null || recoveringMatch || lockCreateActions}
                  >
                    {pending === "create" ? <span className="inline-flex items-center gap-2"><Spinner /> Creating...</span> : "Create Room + Ready Up"}
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <h2 className="text-lg font-bold">Join / Spectate Match</h2>
                {recoveringMatch && (
                  <div className="mt-3 rounded-xl border border-cyan/35 bg-cyan/10 px-3 py-2 text-xs text-cyan">
                    <span className="inline-flex items-center gap-2"><Spinner /> Recovering active arena match from blockchain...</span>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">ArenaMatch Object ID</label>
                    <input
                      className="input"
                      placeholder="0x..."
                      value={joinMatchId}
                      onChange={(e) => setJoinMatchId(e.target.value)}
                      disabled={lockCreateActions || pending !== null || recoveringMatch}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="btn-secondary min-h-12"
                      onClick={() => loadMatch(joinMatchId.trim())}
                      disabled={!joinMatchId || pending !== null || recoveringMatch}
                    >
                      {pending === "load" ? <span className="inline-flex items-center gap-2"><Spinner /> Loading...</span> : "Load Match"}
                    </button>

                    {inviteUrl ? (
                      <button
                        className="btn-ghost min-h-12"
                        onClick={async () => {
                          await navigator.clipboard.writeText(inviteUrl);
                          toast.success("Invite link copied");
                        }}
                      >
                        Copy Invite Link
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Deposit Monster</label>
                    <select
                      className="input"
                      value={joinMonsterId}
                      onChange={(e) => setJoinMonsterId(e.target.value)}
                      disabled={userHasDeposited || pending !== null || recoveringMatch}
                    >
                      <option value="">Select monster</option>
                      {(walletMonsters.data ?? []).map((m) => (
                        <option value={m.objectId} key={m.objectId}>
                          {m.name} ({short(m.objectId)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Matching Stake (SUI)</label>
                    <input
                      className="input"
                      placeholder="0.0"
                      value={joinStake}
                      onChange={(e) => setJoinStake(e.target.value)}
                      disabled={userHasDeposited || pending !== null || recoveringMatch}
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="glass-card space-y-3 p-4" ref={liveSectionRef}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Live Battles</h3>
              <span className="rounded-full border border-cyan/35 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">
                {liveBattles.length} live
              </span>
            </div>
            {arenaMatches.isLoading ? (
              <LoadingGrid count={2} />
            ) : liveBattles.length === 0 ? (
              <div className="text-sm text-gray-400">No live battles to watch right now.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {liveBattles.map((match) => (
                  <button
                    key={match.objectId}
                    className="w-full rounded-[24px] border border-borderSoft bg-black/20 p-4 text-left transition hover:border-cyan/40 hover:bg-cyan/10"
                    onClick={() => {
                      setJoinMatchId(match.objectId);
                      upsertMatchQueryParam(match.objectId);
                      void loadMatch(match.objectId);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-white">
                        {match.monster_a_data?.name ?? short(match.player_a)} vs {match.monster_b_data?.name ?? short(match.player_b)}
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-200">
                        {statusLabel(match.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Stake {toSui(Number(match.stake_a) + Number(match.stake_b))} SUI
                    </div>
                    <div className="mt-4">
                      <span className="btn-secondary text-xs">Watch Battle</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card space-y-3 p-4" ref={historySectionRef}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Recent Fights</h3>
              <Link to="/leaderboard" className="btn-ghost text-xs">
                Go To Leaderboard
              </Link>
            </div>
            {recentMatches.isLoading ? (
              <LoadingGrid count={2} />
            ) : localBattleFeed.length === 0 ? (
              <div className="text-sm text-gray-400">No recent matches found.</div>
            ) : (
              <div className="space-y-2">
                {localBattleFeed.map((entry) => (
                  <div
                    key={entry.id}
                    className="w-full rounded-xl border border-borderSoft bg-black/20 px-3 py-2 text-left text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="font-semibold">{entry.summary}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.onChain ? "bg-cyan/20 text-cyan" : "bg-purple/20 text-purple-200"}`}>
                        {entry.onChain ? "On-chain" : "Lobby"}
                      </span>
                    </div>
                    {entry.onChain && entry.matchId ? (
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => {
                          setJoinMatchId(entry.matchId);
                          upsertMatchQueryParam(entry.matchId);
                          void loadMatch(entry.matchId);
                        }}
                      >
                        Open Match
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {(currentMatchId || activeMatch) && (
        <div className="safe-bottom fixed inset-x-3 bottom-3 z-40 md:hidden">
          <div className="glass-card border-purple/30 bg-black/80 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.24em]">
              <span className="text-cyan/80">Ready Room Actions</span>
              <span className="text-gray-400">{roomStatusLabel}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="btn-primary min-h-12 text-sm"
                onClick={onJoinMatch}
                disabled={!account || !joinMatchId || pending !== null || recoveringMatch || userHasDeposited}
              >
                {userHasDeposited ? "Ready" : "Ready Up"}
              </button>
              <button
                className="btn-secondary min-h-12 text-sm"
                onClick={onStartBattle}
                disabled={!canStartBattle || pending !== null || recoveringMatch}
              >
                Battle
              </button>
              <button
                className="btn-ghost min-h-12 text-sm"
                onClick={onWithdraw}
                disabled={!canWithdraw || pending !== null || recoveringMatch}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
