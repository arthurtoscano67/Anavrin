import type { ReactNode } from "react";

const TONE_CLASS = {
  purple: "border-purple/30 bg-purple/10",
  cyan: "border-cyan/30 bg-cyan/10",
  gold: "border-legendGold/30 bg-legendGold/10",
  neutral: "border-borderSoft bg-white/[0.02]",
} as const;

export function DashboardCard({
  title,
  eyebrow,
  action,
  tone = "neutral",
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  tone?: keyof typeof TONE_CLASS;
  children: ReactNode;
}) {
  return (
    <section className={`glass-card rounded-[28px] border p-5 ${TONE_CLASS[tone]}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {eyebrow && <div className="text-[11px] uppercase tracking-[0.26em] text-gray-400">{eyebrow}</div>}
          <h2 className="mt-1 text-lg font-bold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
