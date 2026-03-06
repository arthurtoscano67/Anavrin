import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { LoadingGrid } from '../components/LoadingGrid';
import { PageShell } from '../components/PageShell';
import { short } from '../lib/format';
import { LobbyPanel } from './lobby/LobbyPanel';
import { ArenaSetupPanel } from './battle-room/ArenaSetupPanel';
import { BattleRoomPanel } from './battle-room/BattleRoomPanel';
import { useBattleRoom, type ArenaSection } from './battle-room/useBattleRoom';

const SECTION_LABELS: Array<{ id: ArenaSection; label: string }> = [
  { id: 'lobby', label: 'Lobby' },
  { id: 'setup', label: 'Setup' },
  { id: 'room', label: 'Room' },
  { id: 'live', label: 'Live' },
  { id: 'history', label: 'History' },
];

export function ArenaExperience() {
  const arena = useBattleRoom();

  return (
    <PageShell
      title="Arena"
      subtitle="Invite, ready up, and battle in live PvP rooms settled on-chain."
    >
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 md:hidden">
        {SECTION_LABELS.map((section) => (
          <button
            key={section.id}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${
              arena.mobileSection === section.id
                ? 'border-purple/50 bg-purple/25 text-white'
                : 'border-borderSoft bg-black/20 text-gray-300'
            }`}
            onClick={() => arena.setMobileSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.95fr] xl:items-start">
        <div className={`${arena.mobileSection === 'lobby' ? 'block' : 'hidden'} min-w-0 md:block xl:order-2`}>
          <LobbyPanel
            selfAddress={arena.account?.address}
            connectionState={arena.presence.connectionState}
            isConnected={arena.presence.isConnected}
            endpoint={arena.presence.endpoint}
            lastError={arena.presence.lastError}
            players={arena.presence.players}
            openMatches={arena.presence.openMatches}
            invites={arena.presence.invites}
            recentMatches={arena.presence.recentMatches}
            busy={arena.pending !== null || arena.recoveringMatch}
            onInvite={arena.onInvitePlayer}
            onCreateOpenMatch={arena.onCreateOpenLobbyMatch}
            onJoinOpenMatch={arena.onJoinOpenLobbyMatch}
            onAcceptInvite={arena.onAcceptLobbyInvite}
          />
        </div>

        <div className={`${arena.mobileSection === 'lobby' ? 'hidden' : 'block'} min-w-0 space-y-4 pb-24 md:block md:pb-0 xl:order-1`}>
          <div className={`${arena.mobileSection === 'setup' ? 'block' : 'hidden'} md:block`}>
            <ArenaSetupPanel
              monsters={arena.walletMonsters.data ?? []}
              isLoading={arena.walletMonsters.isLoading}
              selectedMonsterId={arena.selectedArenaMonsterId}
              selectedMonster={arena.selectedArenaMonster}
              selectedStake={arena.selectedArenaStake}
              selectedStakeLabel={arena.selectedStakeLabel}
              opponent={arena.opponent}
              pending={arena.pending}
              recoveringMatch={arena.recoveringMatch}
              canOpenRoom={arena.canOpenRoom}
              room={arena.room}
              onPickMonster={arena.setArenaMonster}
              onPickStake={arena.setArenaStake}
              onInviteFriend={() => arena.setMobileSection('lobby')}
              onCreateRoom={arena.onCreateMatch}
              onCreateOpenMatch={() => arena.onCreateOpenLobbyMatch(arena.selectedArenaStake || '0')}
              onPractice={() => toast.error('Practice mode needs a contract patch. Self-vs-self cannot fill side B yet.')}
            />
          </div>

          <div className={`${arena.mobileSection === 'room' ? 'block' : 'hidden'} md:block`}>
            <BattleRoomPanel
              accountAddress={arena.account?.address}
              currentMatchId={arena.currentMatchId}
              match={arena.activeMatch}
              resolution={arena.resolution}
              room={arena.room}
              pending={arena.pending}
              recoveringMatch={arena.recoveringMatch}
              inviteUrl={arena.inviteUrl}
              onRefresh={() => arena.loadMatch(arena.currentMatchId)}
              onReset={arena.onResetArenaFlow}
              onDepositLegend={arena.onDepositLegend}
              onStartBattle={arena.onStartBattle}
              onWithdraw={arena.onWithdraw}
            />
          </div>

          <div className={`${arena.mobileSection === 'live' ? 'block' : 'hidden'} glass-card space-y-3 p-4 md:block`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Live Battles</h3>
              <span className="rounded-full border border-cyan/35 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">
                {arena.liveBattles.length} live
              </span>
            </div>
            {arena.arenaMatches.isLoading ? (
              <LoadingGrid count={2} />
            ) : arena.liveBattles.length === 0 ? (
              <div className="text-sm text-gray-400">No live battles to watch right now.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {arena.liveBattles.map((match) => (
                  <button
                    key={match.objectId}
                    className="w-full rounded-[24px] border border-borderSoft bg-black/20 p-4 text-left transition hover:border-cyan/40 hover:bg-cyan/10"
                    onClick={() => {
                      arena.setMobileSection('room');
                      void arena.loadMatch(match.objectId);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-white">
                        {match.monster_a_data?.name ?? short(match.player_a)} vs {match.monster_b_data?.name ?? short(match.player_b)}
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-gray-200">
                        {match.status === 2 ? 'FINISHED' : match.status === 1 ? 'LOCKED' : 'WAITING'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      Stake {(Number(match.stake_a) + Number(match.stake_b)) / 1_000_000_000} SUI
                    </div>
                    <div className="mt-4">
                      <span className="btn-secondary text-xs">Watch Battle</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`${arena.mobileSection === 'history' ? 'block' : 'hidden'} glass-card space-y-3 p-4 md:block`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold">Recent Fights</h3>
              <Link to="/leaderboard" className="btn-ghost text-xs">
                Go To Leaderboard
              </Link>
            </div>
            {arena.recentMatches.isLoading ? (
              <LoadingGrid count={2} />
            ) : arena.recentFeed.length === 0 ? (
              <div className="text-sm text-gray-400">No recent matches found.</div>
            ) : (
              <div className="space-y-2">
                {arena.recentFeed.map((entry) => (
                  <div
                    key={entry.id}
                    className="w-full rounded-xl border border-borderSoft bg-black/20 px-3 py-2 text-left text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="font-semibold">{entry.summary}</div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${entry.onChain ? 'bg-cyan/20 text-cyan' : 'bg-purple/20 text-purple-200'}`}>
                        {entry.onChain ? 'On-chain' : 'Lobby'}
                      </span>
                    </div>
                    {entry.onChain && entry.matchId ? (
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => {
                          arena.setMobileSection('room');
                          void arena.loadMatch(entry.matchId);
                        }}
                      >
                        Open Match
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
