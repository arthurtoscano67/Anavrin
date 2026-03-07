import { toSui, short, statusLabel } from '../../lib/format';
import type { ArenaMatch, MatchResolution } from '../../lib/types';
import type { BattlePreview } from '../battle-engine/battleEngine';
import { PokeHpPanel } from './PokeHpPanel';
import { MonsterImage } from '../../components/MonsterImage';

export function BattleArenaScreen({
  match,
  resolution,
  preview,
  frameIndex,
  animating,
  canAttack,
  pending,
  accountAddress,
  spectator,
  onAttack,
  onSpecial,
  onDefend,
  onEmote,
  onBackRoom,
  onBackLobby,
}: {
  match: ArenaMatch | null;
  resolution: MatchResolution | null;
  preview: BattlePreview | null;
  frameIndex: number;
  animating: boolean;
  canAttack: boolean;
  pending: string | null;
  accountAddress?: string;
  spectator: boolean;
  onAttack: () => void;
  onSpecial: () => void;
  onDefend: () => void;
  onEmote: () => void;
  onBackRoom: () => void;
  onBackLobby: () => void;
}) {
  if (!match) {
    return (
      <div className="poke-ui-box p-8 text-center">
        <p className="poke-label mb-4">No battle loaded.</p>
        <button className="poke-btn-fight" onClick={onBackLobby}>Go to Lobby</button>
      </div>
    );
  }

  const currentFrame = preview?.frames[Math.min(frameIndex, Math.max(0, (preview?.frames.length ?? 1) - 1))];
  const totalStake = Number(match.stake_a || '0') + Number(match.stake_b || '0');

  const isPlayerA   = match.player_a === accountAddress;
  const myMonster   = isPlayerA ? match.monster_a_data : match.monster_b_data;
  const enemyMonster = isPlayerA ? match.monster_b_data : match.monster_a_data;
  const myHp    = Math.max(0, Math.min(100, isPlayerA ? (currentFrame?.leftHp  ?? 100) : (currentFrame?.rightHp ?? 100)));
  const enemyHp = Math.max(0, Math.min(100, isPlayerA ? (currentFrame?.rightHp ?? 100) : (currentFrame?.leftHp  ?? 100)));

  const winnerSide = resolution
    ? resolution.winner === match.player_a ? 'left' : 'right'
    : currentFrame?.winnerSide;

  const iWin    = winnerSide === (isPlayerA ? 'left' : 'right');
  const enemyWin = winnerSide === (isPlayerA ? 'right' : 'left');

  const battleLog = resolution
    ? `${short(resolution.winner)} wins! Payout: ${toSui(resolution.totalPayoutMist)} SUI`
    : currentFrame?.label ?? (canAttack
        ? `What will ${myMonster?.name ?? 'your Legend'} do?`
        : 'Waiting for both players…');

  const myAttacking    = animating && (isPlayerA ? currentFrame?.actor === 'left'  : currentFrame?.actor === 'right');
  const enemyAttacking = animating && (isPlayerA ? currentFrame?.actor === 'right' : currentFrame?.actor === 'left');

  return (
    <div className="poke-battle-root select-none font-mono">

      {/* ── nav strip ── */}
      <div className="mb-2 flex items-center justify-between text-xs text-white/50">
        <div className="flex flex-wrap gap-1">
          <span className="poke-chip">{short(match.objectId)}</span>
          <span className="poke-chip">{toSui(totalStake)} SUI</span>
          <span className="poke-chip">{statusLabel(match.status)}</span>
          {spectator && <span className="poke-chip poke-chip-cyan">Spectator</span>}
        </div>
        <div className="flex gap-1">
          <button className="poke-chip hover:bg-white/15" onClick={onBackRoom}>Room</button>
          <button className="poke-chip hover:bg-white/15" onClick={onBackLobby}>Lobby</button>
        </div>
      </div>

      {/* ══════════════════ BATTLE FIELD ══════════════════ */}
      <div className="poke-field relative overflow-hidden rounded-2xl">

        {/* sky */}
        <div className="poke-sky" />
        {/* ground */}
        <div className="poke-ground" />
        {/* impact flash */}
        {animating && currentFrame?.flash && (
          <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-white/60"
               style={{ animation: 'pokeFade 0.18s ease-out' }} />
        )}

        {/* ENEMY info box – top left */}
        <div className="absolute left-4 top-4 z-10 w-52">
          <PokeHpPanel
            name={enemyMonster?.name ?? 'Enemy'}
            stage={enemyMonster?.stage ?? 0}
            hpPct={enemyHp}
            showHpNumber={false}
            isWinner={enemyWin}
          />
        </div>

        {/* ENEMY sprite – top right (faces left naturally) */}
        <div
          className="absolute right-4 top-4 z-10 h-36 w-36"
          style={{
            animation: enemyAttacking ? 'pokeAttackLeft 0.35s ease-in-out' : undefined,
            filter: enemyWin === false && winnerSide ? 'grayscale(0.7) opacity(0.45)' : undefined,
          }}
        >
          {enemyMonster?.objectId ? (
            <MonsterImage objectId={enemyMonster.objectId} monster={enemyMonster as any} className="h-full w-full" />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-full border-2 border-dashed border-white/20 text-xs text-white/40">
              No Legend
            </div>
          )}
        </div>

        {/* PLAYER sprite – bottom left (mirror so faces right) */}
        <div
          className="absolute bottom-8 left-4 z-10 h-44 w-44"
          style={{
            transform: 'scaleX(-1)',
            animation: myAttacking ? 'pokeAttackRight 0.35s ease-in-out' : undefined,
            filter: iWin === false && winnerSide ? 'grayscale(0.7) opacity(0.45)' : undefined,
          }}
        >
          {myMonster?.objectId ? (
            <MonsterImage objectId={myMonster.objectId} monster={myMonster as any} className="h-full w-full" />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-full border-2 border-dashed border-white/20 text-xs text-white/40">
              No Legend
            </div>
          )}
        </div>

        {/* PLAYER info box – bottom right */}
        <div className="absolute bottom-4 right-4 z-10 w-56">
          <PokeHpPanel
            name={myMonster?.name ?? 'Your Legend'}
            stage={myMonster?.stage ?? 0}
            hpPct={myHp}
            showHpNumber
            xp={myMonster?.xp ?? 0}
            isWinner={iWin}
          />
        </div>

        {/* platform ellipses */}
        <div className="poke-platform-enemy" />
        <div className="poke-platform-player" />
      </div>

      {/* ══════════════════ BOTTOM UI ══════════════════ */}
      <div className="mt-2 grid grid-cols-[1fr_auto] overflow-hidden rounded-2xl border-4 border-[#1a1a2e]">

        {/* battle text box */}
        <div className="poke-textbox flex min-h-[80px] items-center px-5 py-3">
          <p className="poke-battle-text leading-snug">{battleLog}</p>
        </div>

        {/* move grid */}
        <div className="grid grid-cols-2 border-l-4 border-[#1a1a2e]">
          <button className="poke-move-btn poke-move-fight"   onClick={onAttack}  disabled={!canAttack || pending !== null}>⚔ FIGHT</button>
          <button className="poke-move-btn poke-move-special" onClick={onSpecial} disabled={!canAttack || pending !== null}>✦ SPECIAL</button>
          <button className="poke-move-btn poke-move-defend"  onClick={onDefend}  disabled={pending !== null}>🛡 DEFEND</button>
          <button className="poke-move-btn poke-move-run"     onClick={onEmote}   disabled={pending !== null}>♟ EMOTE</button>
        </div>
      </div>

      {/* ── resolution summary ── */}
      {resolution && (
        <div className="poke-ui-box mt-3 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {[
            { label: 'Winner',      value: short(resolution.winner),            color: 'text-green-300' },
            { label: 'Winner Mon',  value: short(resolution.winnerMonsterId),   color: 'text-white'     },
            { label: 'Loser Mon',   value: short(resolution.loserMonsterId),    color: 'text-white'     },
            { label: 'Payout',      value: `${toSui(resolution.totalPayoutMist)} SUI`, color: 'text-yellow-200' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</div>
              <div className={`mt-1 text-lg font-black ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
