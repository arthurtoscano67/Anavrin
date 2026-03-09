export function AnavrinCard({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-[#09131f]/85 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <div className="text-[11px] uppercase tracking-[0.34em] text-[#6ba4d9]">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="mt-2 font-['Space_Grotesk'] text-xl font-bold tracking-tight text-white">
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
