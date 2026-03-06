import { powerPreview, short } from '../../lib/format';
import type { ArenaMonsterSnapshot } from '../../lib/types';
import { MonsterImage } from '../../components/MonsterImage';
import { StageBadge } from '../../components/StageBadge';
import { StatBar } from '../../components/StatBar';

function healthMeter(monster: ArenaMonsterSnapshot): number {
  const base = 45 + monster.stage * 10 + monster.wins * 2 - monster.losses;
  return Math.max(18, Math.min(100, base));
}

export function ArenaMonsterCard({
  monster,
  side,
  playerLabel,
  isReady,
  stakeLabel,
}: {
  monster?: ArenaMonsterSnapshot | null;
  side: 'left' | 'right';
  playerLabel: string;
  isReady: boolean;
  stakeLabel: string;
}) {
  if (!monster) {
    return (
      <div className="arena-monster-card flex min-h-[250px] flex-col justify-between rounded-[28px] border border-dashed border-borderSoft bg-black/25 p-4 sm:min-h-[320px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-gray-400">{side === 'left' ? 'Player A' : 'Player B'}</div>
            <div className="mt-1 text-lg font-bold text-white">{playerLabel}</div>
          </div>
          <span className="rounded-full border border-yellow-400/35 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
            Waiting
          </span>
        </div>

        <div className="grid place-items-center py-6">
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-center text-sm text-gray-400 sm:h-36 sm:w-36">
            <span className="text-2xl">🫧</span>
            <span className="mt-2">Legend not deposited</span>
          </div>
        </div>

        <div className="rounded-2xl border border-borderSoft bg-white/5 px-3 py-3 text-sm text-gray-300">
          Stake {stakeLabel} SUI
        </div>
      </div>
    );
  }

  const power = powerPreview({
    attack: monster.attack,
    defense: monster.defense,
    speed: monster.speed,
    stage: monster.stage,
    xp: monster.xp,
  });
  const hp = healthMeter(monster);

  return (
    <div className={`arena-monster-card rounded-[28px] border p-4 ${isReady ? 'border-cyan/40 bg-black/35 shadow-[0_0_28px_rgba(6,182,212,0.16)]' : 'border-borderSoft bg-black/25'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-gray-400">{side === 'left' ? 'Player A' : 'Player B'}</div>
          <div className="mt-1 text-lg font-bold text-white">{playerLabel}</div>
          <div className="mt-1 text-xs text-gray-400">{short(monster.objectId)}</div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isReady ? 'border border-green-400/35 bg-green-500/10 text-green-200' : 'border border-yellow-400/35 bg-yellow-500/10 text-yellow-200'}`}>
          {isReady ? 'Ready' : 'Waiting'}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <div className={`arena-creature-frame ${side === 'left' ? 'arena-idle-left' : 'arena-idle-right'}`}>
          <div className="arena-creature-glow" />
          <MonsterImage
            objectId={monster.objectId}
            monster={monster}
            className={`relative z-10 mx-auto aspect-square h-32 w-32 border border-white/10 bg-black/40 sm:h-44 sm:w-44 ${side === 'right' ? 'scale-x-[-1]' : ''}`}
          />
          <div className="arena-blink" />
        </div>

        <div className="space-y-3 rounded-[24px] border border-white/8 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-base font-bold text-white">{monster.name}</div>
              <div className="text-xs text-cyan">Power {power}</div>
            </div>
            <StageBadge stage={monster.stage} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-gray-400">
              <span>Vitality</span>
              <span>{hp}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10">
              <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-cyan to-blue-400" style={{ width: `${hp}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Record</div>
              <div className="mt-1 font-semibold text-white">{monster.wins}W / {monster.losses}L</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400">XP</div>
              <div className="mt-1 font-semibold text-white">{monster.xp}</div>
            </div>
          </div>

          <div className="space-y-2">
            <StatBar label="ATK" value={monster.attack} color="bg-red-500" />
            <StatBar label="DEF" value={monster.defense} color="bg-blue-500" />
            <StatBar label="SPD" value={monster.speed} color="bg-green-500" />
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm text-gray-200">
            <div className="flex items-center justify-between gap-3">
              <span>Stake {stakeLabel} SUI</span>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isReady ? 'bg-green-500/15 text-green-200' : 'bg-yellow-500/15 text-yellow-100'}`}>
                {isReady ? 'Wager locked' : 'Waiting'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
