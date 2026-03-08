import type { ItemDefinition } from "../lib/types";
import { itemAccent, itemBonusSummary, itemDurationLabel, itemIcon, itemSupplyRemaining, itemTypeLabel } from "../lib/items";
import { toSui } from "../lib/format";
import { Spinner } from "./Spinner";

export function MarketplaceCard({
  definition,
  isPending,
  disabled,
  onBuy,
}: {
  definition: ItemDefinition;
  isPending: boolean;
  disabled: boolean;
  onBuy: (definition: ItemDefinition) => void;
}) {
  const remaining = itemSupplyRemaining(definition);

  return (
    <article className="glass-card card-hover overflow-hidden rounded-[24px] border border-white/10">
      <div className={`bg-gradient-to-br p-4 ${itemAccent(definition.kind)}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/20 bg-black/20 text-3xl">
            {itemIcon(definition.kind, definition.slot)}
          </div>
          <span className="rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-white">
            {itemTypeLabel(definition.kind)}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-base font-extrabold text-white">{definition.name}</h3>
          <p className="mt-1 text-xs text-gray-300">{itemBonusSummary(definition)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-white/10 bg-cyan/10 p-2 text-cyan-100">
            {toSui(definition.priceMist)} SUI
          </div>
          <div className="rounded-2xl border border-white/10 bg-purple/15 p-2 text-purple-100">
            {remaining === null ? "Unlimited" : `${remaining} left`}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-gray-200">
          {itemDurationLabel(definition.durationMs)}
        </div>

        <button className="btn-primary w-full text-sm" disabled={disabled || isPending} onClick={() => onBuy(definition)}>
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size={14} /> Buying...
            </span>
          ) : (
            "Buy Item"
          )}
        </button>
      </div>
    </article>
  );
}
