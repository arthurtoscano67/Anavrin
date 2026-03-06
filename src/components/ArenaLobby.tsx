import { useMemo, useState } from "react";

import { short } from "../app/lib/format";
import type {
  LobbyConnectionState,
  LobbyInvite,
  LobbyOpenMatch,
  LobbyPlayer,
  LobbyRecentMatch,
} from "../hooks/useLobby";

type ArenaLobbyProps = {
  selfAddress?: string;
  connectionState: LobbyConnectionState;
  isConnected: boolean;
  endpoint: string;
  lastError?: string | null;
  players: LobbyPlayer[];
  openMatches: LobbyOpenMatch[];
  invites: LobbyInvite[];
  recentMatches: LobbyRecentMatch[];
  busy?: boolean;
  onInvite: (to: string) => void;
  onCreateOpenMatch: (stakeSui: string) => void;
  onJoinOpenMatch: (match: LobbyOpenMatch) => void;
  onAcceptInvite: (invite: LobbyInvite) => void;
};

function formatWhen(timestamp: number): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (deltaSeconds < 60) return "just now";
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86_400) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  return `${Math.floor(deltaSeconds / 86_400)}d ago`;
}

function connectionTone(state: LobbyConnectionState): string {
  if (state === "open") return "text-green-300";
  if (state === "connecting") return "text-cyan";
  if (state === "error") return "text-red-300";
  return "text-gray-400";
}

function trainerBadge(address: string): string {
  return address.slice(2, 4).toUpperCase();
}

export function ArenaLobby({
  selfAddress,
  connectionState,
  isConnected,
  endpoint,
  lastError,
  players,
  openMatches,
  invites,
  recentMatches,
  busy = false,
  onInvite,
  onCreateOpenMatch,
  onJoinOpenMatch,
  onAcceptInvite,
}: ArenaLobbyProps) {
  const [stakeInput, setStakeInput] = useState("");
  const statusOpen = isConnected || connectionState === "connecting";
  const criticalConfigError = Boolean(lastError && lastError.includes("serving the site HTML"));

  const incomingInvites = useMemo(
    () => invites.filter((invite) => invite.to === selfAddress && invite.status === "pending"),
    [invites, selfAddress]
  );

  const visiblePlayers = useMemo(
    () => players.filter((player) => player.address !== selfAddress),
    [players, selfAddress]
  );

  const visibleMatches = useMemo(
    () => openMatches.filter((match) => match.creator !== selfAddress),
    [openMatches, selfAddress]
  );

  const submitOpenMatch = () => {
    onCreateOpenMatch(stakeInput.trim() || "0");
    setStakeInput("");
  };

  return (
    <aside className="glass-card space-y-4 overflow-hidden border-purple/30 bg-gradient-to-br from-surface via-[#121629] to-[#101a28] p-4 lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan/75">Arena Lobby</div>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Pick a trainer, invite, battle.</h3>
          <p className="mt-1 text-sm text-gray-300">Mobile flow: invite, accept, ready up, then either player can start.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusOpen ? "border-green-400/35 bg-green-500/10 text-green-200" : connectionTone(connectionState)}`}>
          {statusOpen ? "Open" : "Closed"}
        </span>
      </div>

      {criticalConfigError && (
        <div className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="font-semibold">Lobby disconnected</div>
          {lastError ? <div className="mt-1 text-red-100/90">{lastError}</div> : null}
          <div className="mt-2 text-xs text-red-100/70">Endpoint: {endpoint || "not set"}</div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-[24px] border border-cyan/25 bg-cyan/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan/80">Quick Post</div>
          <div className="mt-2 text-lg font-bold text-white">Create an open room</div>
          <p className="mt-1 text-sm text-gray-300">Post a wager and let any online trainer jump in.</p>
        </div>
        <div className="grid gap-2 sm:w-[220px]">
          <input
            className="input"
            placeholder="Wager in SUI"
            value={stakeInput}
            onChange={(event) => setStakeInput(event.target.value)}
          />
          <button className="btn-secondary min-h-14 text-base" onClick={submitOpenMatch} disabled={!isConnected || busy}>
            Post Open Match
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Online Trainers</div>
            <div className="mt-1 text-lg font-bold text-white">Tap a trainer to send an invite</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
            {visiblePlayers.length}
          </span>
        </div>

        {connectionState === "connecting" && visiblePlayers.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="skeleton h-40" />
            <div className="skeleton h-40" />
          </div>
        ) : visiblePlayers.length === 0 ? (
          <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
            Waiting for trainers to come online.
          </div>
        ) : (
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-1">
            {visiblePlayers.map((player) => (
              <article
                key={player.address}
                className="min-w-[255px] snap-start rounded-[26px] border border-white/8 bg-black/20 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple to-cyan text-sm font-black text-white">
                    {trainerBadge(player.address)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{short(player.address)}</div>
                    <div className="text-xs text-gray-400">Online now</div>
                  </div>
                </div>

                <div className="mt-4 rounded-[22px] border border-white/8 bg-white/5 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Selected Legend</div>
                  <div className="mt-2 text-lg font-bold text-white">{player.monsterName}</div>
                  <div className="mt-1 text-sm text-cyan">Level {player.level}</div>
                </div>

                <button
                  className="btn-primary mt-4 min-h-14 w-full text-base"
                  onClick={() => onInvite(player.address)}
                  disabled={!isConnected || busy}
                >
                  Invite To Battle
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Invites</div>
              <div className="mt-1 text-lg font-bold text-white">Accept and enter the ready room</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
              {incomingInvites.length}
            </span>
          </div>

          {incomingInvites.length === 0 ? (
            <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
              No pending invites.
            </div>
          ) : (
            <div className="space-y-3">
              {incomingInvites.map((invite) => (
                <article key={invite.id} className="rounded-[24px] border border-purple/30 bg-purple/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{short(invite.from)} wants to battle</div>
                      <div className="mt-1 text-sm text-gray-300">{invite.monsterName} • Level {invite.level}</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-purple-100">
                      Invite
                    </span>
                  </div>
                  <button
                    className="btn-primary mt-4 min-h-14 w-full text-base"
                    onClick={() => onAcceptInvite(invite)}
                    disabled={!isConnected || busy}
                  >
                    Accept Invite
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Open Matches</div>
              <div className="mt-1 text-lg font-bold text-white">Join a public battle room</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
              {visibleMatches.length}
            </span>
          </div>

          {visibleMatches.length === 0 ? (
            <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
              No open battles yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMatches.map((match) => (
                <article key={match.id} className="rounded-[24px] border border-cyan/25 bg-cyan/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{match.creatorMonster} waiting</div>
                      <div className="mt-1 text-sm text-gray-300">{short(match.creator)} • Wager {match.stakeSui || "0"} SUI</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-cyan">
                      Open
                    </span>
                  </div>
                  <button
                    className="btn-secondary mt-4 min-h-14 w-full text-base"
                    onClick={() => onJoinOpenMatch(match)}
                    disabled={!isConnected || busy}
                  >
                    Join Match
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Recent Lobby Activity</div>
        {recentMatches.length === 0 ? (
          <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
            No recent lobby activity.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentMatches.slice(0, 4).map((entry) => (
              <article key={entry.id} className="rounded-[22px] border border-white/8 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">{entry.summary}</div>
                <div className="mt-2 text-xs text-gray-500">{formatWhen(entry.timestamp)}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
