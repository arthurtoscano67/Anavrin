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
    <aside className="glass-card space-y-4 p-4 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Arena Lobby</h3>
        <span className={`text-xs font-semibold uppercase tracking-wide ${connectionTone(connectionState)}`}>
          {connectionState}
        </span>
      </div>

      {!isConnected && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
          <div className="font-semibold">Lobby disconnected</div>
          {lastError ? <div className="mt-1 text-red-100/90">{lastError}</div> : null}
          <div className="mt-1 text-red-100/70">Endpoint: {endpoint || "not set"}</div>
        </div>
      )}

      <div className="rounded-xl border border-borderSoft bg-black/20 p-3">
        <div className="mb-2 text-xs font-semibold text-gray-300">Create Open Match</div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Stake (SUI)"
            value={stakeInput}
            onChange={(event) => setStakeInput(event.target.value)}
          />
          <button
            className="btn-secondary"
            onClick={submitOpenMatch}
            disabled={!isConnected || busy}
          >
            Post
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">Online Players</div>
        {connectionState === "connecting" && visiblePlayers.length === 0 ? (
          <div className="space-y-2">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
        ) : visiblePlayers.length === 0 ? (
          <div className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm text-gray-400">
            No players online.
          </div>
        ) : (
          <div className="space-y-2">
            {visiblePlayers.map((player) => (
              <div key={player.address} className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{short(player.address)}</div>
                    <div className="text-xs text-gray-400">
                      Monster: {player.monsterName} • Level {player.level}
                    </div>
                  </div>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => onInvite(player.address)}
                    disabled={!isConnected || busy}
                  >
                    Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">Open Matches</div>
        {visibleMatches.length === 0 ? (
          <div className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm text-gray-400">
            No open matches right now.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleMatches.map((match) => (
              <div key={match.id} className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm">
                <div className="font-semibold">Match #{short(match.id)}</div>
                <div className="text-xs text-gray-400">
                  {short(match.creator)} vs Open • Stake {match.stakeSui || "0"} SUI
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    className="btn-primary text-xs"
                    onClick={() => onJoinOpenMatch(match)}
                    disabled={!isConnected || busy}
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">Invites</div>
        {incomingInvites.length === 0 ? (
          <div className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm text-gray-400">
            No pending invites.
          </div>
        ) : (
          <div className="space-y-2">
            {incomingInvites.map((invite) => (
              <div key={invite.id} className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm">
                <div className="font-semibold">{short(invite.from)} invited you</div>
                <div className="text-xs text-gray-400">
                  {invite.monsterName} • Level {invite.level}
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    className="btn-primary text-xs"
                    onClick={() => onAcceptInvite(invite)}
                    disabled={!isConnected || busy}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">Recent Matches</div>
        {recentMatches.length === 0 ? (
          <div className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm text-gray-400">
            No recent lobby activity.
          </div>
        ) : (
          <div className="space-y-2">
            {recentMatches.slice(0, 12).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-borderSoft bg-black/20 p-3 text-sm">
                <div className="text-gray-100">{entry.summary}</div>
                <div className="text-xs text-gray-500">{formatWhen(entry.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
