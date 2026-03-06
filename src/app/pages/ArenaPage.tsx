import { Link, useSearchParams } from 'react-router-dom';

import { PageShell } from '../components/PageShell';

export function ArenaPage() {
  const [params] = useSearchParams();
  const staleMatchId = params.get('match');

  return (
    <PageShell
      title="Arena Reset"
      subtitle="The previous arena system has been removed. This page is now a clean reset point for the next rebuild."
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass-card space-y-4 p-5 sm:p-6">
          <div className="inline-flex rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-red-100">
            Fresh Start
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Old arena flow deleted.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
            The prior lobby, room, and battle flow has been removed so the arena can be rebuilt cleanly.
            There is no active multiplayer UI on this route right now.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-borderSoft bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Step 1</div>
              <div className="mt-2 text-xl font-bold text-white">Lobby</div>
              <div className="mt-1 text-sm text-gray-400">Rebuild player presence and invites from zero.</div>
            </div>
            <div className="rounded-3xl border border-borderSoft bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Step 2</div>
              <div className="mt-2 text-xl font-bold text-white">Battle Room</div>
              <div className="mt-1 text-sm text-gray-400">Rebuild deposit, withdraw, and ready states cleanly.</div>
            </div>
            <div className="rounded-3xl border border-borderSoft bg-black/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Step 3</div>
              <div className="mt-2 text-xl font-bold text-white">Battle Engine</div>
              <div className="mt-1 text-sm text-gray-400">Keep all rules and transitions outside the renderer.</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="btn-primary w-full sm:w-auto" to="/">
              Go Back Home
            </Link>
            <Link className="btn-secondary w-full sm:w-auto" to="/legends">
              View My Legends
            </Link>
          </div>
        </section>

        <aside className="glass-card space-y-4 p-5 sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Status</div>
          <div className="rounded-3xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            Arena route is intentionally disabled while the new system is designed.
          </div>

          {staleMatchId ? (
            <div className="rounded-3xl border border-borderSoft bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">Stale match link detected</div>
              <div className="mt-2 break-all text-xs text-gray-400">{staleMatchId}</div>
              <div className="mt-3 text-sm text-gray-300">
                This match link is not being loaded anymore. The old room implementation was removed.
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-borderSoft bg-black/20 p-4">
            <div className="text-sm font-semibold text-white">Why this page is blank now</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-400">
              <li>Current arena UI was too messy to maintain.</li>
              <li>Rebuild needs a new lobby → room → battle flow.</li>
              <li>Starting from zero is lower risk than patching again.</li>
            </ul>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
