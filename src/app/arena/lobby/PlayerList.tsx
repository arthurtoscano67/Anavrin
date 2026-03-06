import type { LobbyPlayer } from '../network/useArenaPresence';
import { short } from '../../lib/format';

type PlayerListProps = {
  players: LobbyPlayer[];
  disabled?: boolean;
  onInvite: (address: string) => void;
};

function trainerBadge(address: string): string {
  return address.slice(2, 4).toUpperCase();
}

export function PlayerList({ players, disabled = false, onInvite }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="rounded-[24px] border border-borderSoft bg-black/20 p-4 text-sm text-gray-400">
        No trainers yet.
      </div>
    );
  }

  return (
    <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-1">
      {players.map((player) => (
        <article
          key={player.address}
          className="min-w-[255px] snap-start rounded-[30px] border border-white/8 bg-black/20 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-purple to-cyan text-base font-black text-white">
              {trainerBadge(player.address)}
            </div>
            <div>
              <div className="text-base font-black text-white">{short(player.address)}</div>
              <div className="text-xs font-semibold text-gray-400">Online now</div>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-white/5 p-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Legend</div>
            <div className="mt-2 text-2xl font-black text-white">{player.monsterName}</div>
            <div className="mt-1 text-sm font-semibold text-cyan">Level {player.level}</div>
          </div>

          <button
            className="mt-4 min-h-[76px] w-full rounded-[24px] border border-green-300/50 bg-gradient-to-br from-green-500 to-emerald-400 text-xl font-black text-slate-950 shadow-[0_18px_40px_rgba(34,197,94,0.25)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onInvite(player.address)}
            disabled={disabled}
          >
            Invite!
          </button>
        </article>
      ))}
    </div>
  );
}
