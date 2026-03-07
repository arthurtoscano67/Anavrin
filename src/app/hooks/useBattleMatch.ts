import { useQuery } from '@tanstack/react-query';
import { useSuiClient } from '@mysten/dapp-kit';

import { fetchArenaMatch, fetchMatchResolution } from '../lib/sui';

export function useBattleMatch(matchId?: string) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ['battleMatch', matchId],
    enabled: Boolean(matchId),
    refetchInterval: 3_000,
    queryFn: async () => {
      if (!matchId) {
        return { match: null, resolution: null };
      }

      const [match, resolution] = await Promise.all([
        fetchArenaMatch(client, matchId),
        fetchMatchResolution(client, matchId),
      ]);

      return { match, resolution };
    },
  });
}
