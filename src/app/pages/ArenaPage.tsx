import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ArenaLobby } from "../../components/ArenaLobby";
import type { LobbyInvite, LobbyOpenMatch } from "../../hooks/useLobby";
import { useLobby } from "../../hooks/useLobby";

import { LoadingGrid } from "../components/LoadingGrid";
import { PageShell } from "../components/PageShell";
import { Spinner } from "../components/Spinner";
import {
  ARENA_MATCH_TYPE,
  CLOCK_ID,
  MODULE,
  PACKAGE_ID,
  TREASURY_ID,
} from "../lib/constants";
import { short, statusLabel, toMist, toSui } from "../lib/format";
import { fetchArenaMatch, fetchMatchResolution } from "../lib/sui";
import type { ArenaMatch, BattleOutcomeEvent, MatchResolution } from "../lib/types";
import { useAnavrinData } from "../hooks/useAnavrinData";
import { useTxExecutor } from "../hooks/useTxExecutor";

function isValidSuiAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]{2,}$/.test(input.trim());
}

export function ArenaPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [params, setParams] = useSearchParams();
  const { walletMonsters, recentMatches } = useAnavrinData();
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

  const loadMatch = useCallback(async (matchId: string) => {
    if (!matchId) return;
    setPending("load");
    try {
      const [match, matchResolution] = await Promise.all([
        fetchArenaMatch(client, matchId),
        fetchMatchResolution(client, matchId),
      ]);
      setActiveMatch(match);
      setResolution(matchResolution);
    } catch (error) {
      setActiveMatch(null);
      setResolution(null);
      toast.error(error instanceof Error ? error.message : "Unable to load match");
    } finally {
      setPending(null);
    }
  }, [client]);

  const upsertMatchQueryParam = useCallback((matchId: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("match", matchId);
      return next;
    });
  }, [setParams]);

  useEffect(() => {
    if (!account?.address) return;
    const started = lobby.pendingMatchStart;
    if (!started) return;
    if (started.from !== account.address && started.to !== account.address) return;

    const opponentAddress = started.from === account.address ? started.to : started.from;
    setOpponent(opponentAddress);

    if (started.matchId) {
      setJoinMatchId(started.matchId);
      upsertMatchQueryParam(started.matchId);
      void loadMatch(started.matchId);
    }

    toast.success(
      started.matchId
        ? `Lobby match ready with ${short(opponentAddress)}`
        : `Lobby duel confirmed with ${short(opponentAddress)}. Create the on-chain match.`
    );
    lobby.clearPendingMatchStart();
  }, [account?.address, loadMatch, lobby.clearPendingMatchStart, lobby.pendingMatchStart, upsertMatchQueryParam]);

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

  const canStartBattle =
    activeMatch &&
    activeMatch.status === 1 &&
    account &&
    (account.address === activeMatch.player_a || account.address === activeMatch.player_b);

  return (
    <PageShell
      title="Arena"
      subtitle="Create and join live PvP matches. Every battle settles on-chain with real staking and permanent monster progression."
    >
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">
            Create Match | Join Match
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card space-y-4 p-4">
              <h2 className="text-lg font-bold">Create Match</h2>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Opponent Address</label>
                <input
                  className="input"
                  placeholder="0x..."
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Your Monster</label>
                <select
                  className="input"
                  value={createMonsterId}
                  onChange={(e) => setCreateMonsterId(e.target.value)}
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
                />
              </div>

              <button className="btn-primary w-full" onClick={onCreateMatch} disabled={!account || pending !== null}>
                {pending === "create" ? <span className="inline-flex items-center gap-2"><Spinner /> Creating...</span> : "Create & Send Invite"}
              </button>
            </div>

            <div className="glass-card space-y-4 p-4">
              <h2 className="text-lg font-bold">Join / Spectate Match</h2>
              <div className="space-y-2">
                <label className="text-xs text-gray-400">ArenaMatch Object ID</label>
                <input
                  className="input"
                  placeholder="0x..."
                  value={joinMatchId}
                  onChange={(e) => setJoinMatchId(e.target.value)}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="btn-secondary"
                  onClick={() => loadMatch(joinMatchId.trim())}
                  disabled={!joinMatchId || pending !== null}
                >
                  {pending === "load" ? <span className="inline-flex items-center gap-2"><Spinner /> Loading...</span> : "Load Match"}
                </button>

                {inviteUrl && (
                  <button
                    className="btn-ghost"
                    onClick={async () => {
                      await navigator.clipboard.writeText(inviteUrl);
                      toast.success("Invite link copied");
                    }}
                  >
                    Copy Invite Link
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">Deposit Monster</label>
                <select
                  className="input"
                  value={joinMonsterId}
                  onChange={(e) => setJoinMonsterId(e.target.value)}
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
                <label className="text-xs text-gray-400">Optional Matching Stake (SUI)</label>
                <input
                  className="input"
                  placeholder="0.0"
                  value={joinStake}
                  onChange={(e) => setJoinStake(e.target.value)}
                />
              </div>

              <button className="btn-primary w-full" onClick={onJoinMatch} disabled={!account || !joinMatchId || pending !== null}>
                {pending === "join" ? <span className="inline-flex items-center gap-2"><Spinner /> Sending...</span> : "Deposit To Match"}
              </button>

              <button
                className="btn-secondary w-full"
                onClick={onStartBattle}
                disabled={!canStartBattle || pending !== null}
              >
                {pending === "battle" ? <span className="inline-flex items-center gap-2"><Spinner /> Resolving...</span> : "Start Battle"}
              </button>

              <p className="text-xs text-gray-400">
                Spectator mode: anyone can load a match by ID and watch status + final outcome.
              </p>
            </div>
          </div>

          <div className="glass-card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Match Status</h3>
              <button
                className="btn-ghost"
                disabled={!currentMatchId || pending !== null}
                onClick={() => loadMatch(currentMatchId)}
              >
                Refresh
              </button>
            </div>

            {!activeMatch && (
              <div className="rounded-xl border border-borderSoft bg-black/20 p-4 text-sm text-gray-300">
                Load a match to see deposits, lock state, and results.
              </div>
            )}

            {activeMatch && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-purple/40 bg-purple/20 px-2 py-1 text-xs font-semibold text-purple-200">
                    {statusLabel(activeMatch.status)}
                  </span>
                  <span className="text-gray-400">Match: {short(activeMatch.objectId)}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-borderSoft bg-black/20 p-3">
                    <div className="text-xs text-gray-400">Player A</div>
                    <div className="font-semibold">{short(activeMatch.player_a)}</div>
                    <div className="mt-1 text-xs text-gray-300">Monster: {short(activeMatch.mon_a)}</div>
                    <div className="text-xs text-cyan">Stake: {toSui(activeMatch.stake_a)} SUI</div>
                  </div>
                  <div className="rounded-xl border border-borderSoft bg-black/20 p-3">
                    <div className="text-xs text-gray-400">Player B</div>
                    <div className="font-semibold">{short(activeMatch.player_b)}</div>
                    <div className="mt-1 text-xs text-gray-300">Monster: {short(activeMatch.mon_b)}</div>
                    <div className="text-xs text-cyan">Stake: {toSui(activeMatch.stake_b)} SUI</div>
                  </div>
                </div>
              </div>
            )}

            {resolution && (
              <div className="rounded-xl border border-cyan/40 bg-cyan/10 p-4 text-sm">
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

          <div className="glass-card space-y-3 p-4">
            <h3 className="text-lg font-bold">On-Chain Recent Matches</h3>
            {recentMatches.isLoading ? (
              <LoadingGrid count={2} />
            ) : (recentMatches.data ?? []).length === 0 ? (
              <div className="text-sm text-gray-400">No recent matches found.</div>
            ) : (
              <div className="space-y-2">
                {(recentMatches.data ?? []).slice(0, 8).map((m) => (
                  <button
                    key={m.objectId}
                    className="w-full rounded-xl border border-borderSoft bg-black/20 px-3 py-2 text-left text-sm transition hover:border-purple/50"
                    onClick={() => {
                      setJoinMatchId(m.objectId);
                      upsertMatchQueryParam(m.objectId);
                      void loadMatch(m.objectId);
                    }}
                  >
                    <div className="font-semibold">{short(m.objectId)}</div>
                    <div className="text-xs text-gray-400">{statusLabel(m.status)} • {short(m.player_a)} vs {short(m.player_b)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <ArenaLobby
          selfAddress={account?.address}
          connectionState={lobby.connectionState}
          isConnected={lobby.isConnected}
          players={lobby.players}
          openMatches={lobby.openMatches}
          invites={lobby.invites}
          recentMatches={lobby.recentMatches}
          busy={pending !== null}
          onInvite={onInvitePlayer}
          onCreateOpenMatch={onCreateOpenLobbyMatch}
          onJoinOpenMatch={onJoinOpenLobbyMatch}
          onAcceptInvite={onAcceptLobbyInvite}
        />
      </div>
    </PageShell>
  );
}
