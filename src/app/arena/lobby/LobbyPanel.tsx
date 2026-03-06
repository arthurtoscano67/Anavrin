import { useMemo, useState } from 'react';

import { short } from '../../lib/format';
import { PlayerList } from './PlayerList';
import type {
  LobbyConnectionState,
  LobbyInvite,
  LobbyOpenMatch,
  LobbyPlayer,
  LobbyRecentMatch,
} from '../network/useArenaPresence';

type LobbyPanelProps = {
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
  if (deltaSeconds < 60) return 'just now';
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86_400) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  return `${Math.floor(deltaSeconds / 86_400)}d ago`;
}

function connectionTone(state: LobbyConnectionState): string {
  if (state === 'open') return 'text-green-300';
  if (state === 'connecting') return 'text-cyan';
  if (state === 'error') return 'text-red-300';
  return 'text-gray-400';
}

export function LobbyPanel({
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
}: LobbyPanelProps) {
  const [stakeInput, setStakeInput] = useState('');
  const statusOpen = isConnected || connectionState === 'connecting';
  const criticalConfigError = Boolean(lastError && lastError.includes('serving the site HTML'));

  const incomingInvites = useMemo(
    () => invites.filter((invite) => invite.to === selfAddress && invite.status === 'pending'),
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
    onCreateOpenMatch(stakeInput.trim() || '0');
    setStakeInput('');
  };

  return (
    <aside className="glass-card space-y-5 overflow-hidden border-cyan/25 bg-gradient-to-br from-[#10172c] via-[#11152a] to-[#171236] p-4 lg:sticky lg:top-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan/75">Lobby</div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white">Tap a trainer.</h3>
          <p className="mt-1 text-sm font-semibold text-gray-300">Invite. Accept. Ready. Battle.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusOpen ? 'border-green-400/35 bg-green-500/10 text-green-200' : connectionTone(connectionState)}`}>
          {statusOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      {criticalConfigError ? (
        <div className="rounded-[24px] border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="font-semibold">Lobby disconnected</div>
          {lastError ? <div className="mt-1 text-red-100/90">{lastError}</div> : null}
          <div className="mt-2 text-xs text-red-100/70">Endpoint: {endpoint || 'not set'}</div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-[28px] border border-cyan/30 bg-gradient-to-br from-cyan/20 to-sky-500/10 p-5">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan/80">Quick Post</div>
          <div className="mt-2 text-2xl font-black text-white">Open Battle Room</div>
          <p className="mt-1 text-sm font-semibold text-white/85">Set a wager. Wait for a challenger.</p>
        </div>
        <div className="grid gap-2 sm:w-[220px]">
          <input
            className="input min-h-12"
            placeholder="Wager in SUI"
            value={stakeInput}
            onChange={(event) => setStakeInput(event.target.value)}
          />
          <button
            className="min-h-[72px] rounded-[24px] border border-blue-300/50 bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-black text-white shadow-[0_16px_32px_rgba(59,130,246,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submitOpenMatch}
            disabled={!isConnected || busy}
          >
            Post Match!
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Online Trainers</div>
            <div className="mt-1 text-xl font-black text-white">Tap to invite</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
            {visiblePlayers.length}
          </span>
        </div>

        {connectionState === 'connecting' && visiblePlayers.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="skeleton h-40" />
            <div className="skeleton h-40" />
          </div>
        ) : (
          <PlayerList players={visiblePlayers} disabled={!isConnected || busy} onInvite={onInvite} />
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Invites</div>
              <div className="mt-1 text-xl font-black text-white">Accept and go</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
              {incomingInvites.length}
            </span>
          </div>

          {incomingInvites.length === 0 ? (
            <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
              No invites waiting.
            </div>
          ) : (
            <div className="space-y-3">
              {incomingInvites.map((invite) => (
                <article key={invite.id} className="rounded-[28px] border border-purple/30 bg-gradient-to-br from-purple/20 to-pink-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{short(invite.from)} wants in</div>
                      <div className="mt-1 text-sm font-semibold text-gray-300">{invite.monsterName} • Level {invite.level}</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-purple-100">
                      Invite
                    </span>
                  </div>
                  <button
                    className="mt-4 min-h-[76px] w-full rounded-[24px] border border-green-300/50 bg-gradient-to-br from-green-500 to-emerald-400 text-xl font-black text-slate-950 shadow-[0_18px_40px_rgba(34,197,94,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onAcceptInvite(invite)}
                    disabled={!isConnected || busy}
                  >
                    Accept!
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
              <div className="mt-1 text-xl font-black text-white">Jump into a room</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-200">
              {visibleMatches.length}
            </span>
          </div>

          {visibleMatches.length === 0 ? (
            <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
              No open rooms.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleMatches.map((match) => (
                <article key={match.id} className="rounded-[28px] border border-cyan/25 bg-gradient-to-br from-cyan/20 to-blue-500/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">{match.creatorMonster}</div>
                      <div className="mt-1 text-sm font-semibold text-gray-300">{short(match.creator)} • {match.stakeSui || '0'} SUI</div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-cyan">
                      Open
                    </span>
                  </div>
                  <button
                    className="mt-4 min-h-[76px] w-full rounded-[24px] border border-cyan/50 bg-gradient-to-br from-cyan-400 to-blue-500 text-xl font-black text-slate-950 shadow-[0_18px_40px_rgba(6,182,212,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onJoinOpenMatch(match)}
                    disabled={!isConnected || busy}
                  >
                    Join!
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
            No recent fights.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentMatches.slice(0, 4).map((entry) => (
              <article key={entry.id} className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                <div className="text-base font-black text-white">{entry.summary}</div>
                <div className="mt-2 text-xs font-semibold text-gray-500">{formatWhen(entry.timestamp)}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
