import { MonsterImage } from '../../components/MonsterImage';
import { powerPreview, stageMeta } from '../../lib/format';
import type { Monster } from '../../lib/types';

export function LegendPickerTile({
  monster,
  active,
  locked,
  onSelect,
}: {
  monster: Monster;
  active: boolean;
  locked?: boolean;
  onSelect: () => void;
}) {
  const stage = stageMeta(monster.stage);
  const power = powerPreview(monster);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={locked}
      className={`min-w-[174px] rounded-[28px] border p-3 text-left transition ${
        active
          ? 'arena-ready-glow border-green-300/70 bg-gradient-to-br from-green-500/25 to-emerald-400/10'
          : 'border-white/10 bg-black/25 hover:border-cyan/40 hover:bg-cyan/10'
      } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
          {stage.label}
        </span>
        {active ? (
          <span className="rounded-full bg-green-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950">
            Selected
          </span>
        ) : null}
      </div>
      <MonsterImage objectId={monster.objectId} monster={monster} className="mt-3 aspect-square h-28 w-full rounded-[24px] border border-white/10 bg-black/30" />
      <div className="mt-3 text-lg font-black text-white">{monster.name}</div>
      <div className="mt-1 text-xs text-cyan">Power {power}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-semibold text-white/80">
        <div className="rounded-2xl bg-white/5 px-2 py-2 text-center">ATK {monster.attack}</div>
        <div className="rounded-2xl bg-white/5 px-2 py-2 text-center">DEF {monster.defense}</div>
        <div className="rounded-2xl bg-white/5 px-2 py-2 text-center">SPD {monster.speed}</div>
      </div>
    </button>
  );
}
