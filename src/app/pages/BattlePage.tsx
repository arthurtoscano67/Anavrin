import { useParams } from 'react-router-dom';

import { PageShell } from '../components/PageShell';
import { MatchRouteView } from '../arena/MatchRouteView';

export function BattlePage() {
  const { matchId = '' } = useParams();

  return (
    <PageShell title="Battle" subtitle="This page only loads one ArenaMatch and restores it from the chain.">
      <MatchRouteView matchId={matchId} />
    </PageShell>
  );
}
