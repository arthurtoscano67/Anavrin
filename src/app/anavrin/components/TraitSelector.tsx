import type { AvatarOption } from "../types";

export function TraitSelector<T extends number | string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: AvatarOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-[#87a3bf]">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                active
                  ? "border-[#67d8b3] bg-[#67d8b3]/12 text-white"
                  : "border-white/8 bg-white/[0.03] text-[#c7d3df] hover:border-[#4f88b8]/50 hover:bg-[#4f88b8]/10"
              }`}
            >
              <div className="flex items-center gap-2">
                {option.swatch ? (
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-white/30"
                    style={{ backgroundColor: option.swatch }}
                  />
                ) : null}
                <span className="text-sm font-semibold">{option.label}</span>
              </div>
              {option.description ? (
                <div className="mt-1 text-xs text-[#87a3bf]">
                  {option.description}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
