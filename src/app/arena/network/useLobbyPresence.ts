import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildArenaSocketUrl } from './socket';
import type {
  LobbyConnectionState,
  LobbyInvite,
  LobbyOpenMatch,
  LobbyPlayer,
  LobbyRecentMatch,
  StartedMatch,
} from './types';

type UseLobbyPresenceOptions = {
  enabled: boolean;
  address?: string;
  monsterName?: string;
  level?: number;
};

type LobbyEnvelope = {
  type?: string;
  players?: LobbyPlayer[];
  openMatches?: LobbyOpenMatch[];
  invites?: LobbyInvite[];
  recentMatches?: LobbyRecentMatch[];
  invite?: LobbyInvite;
  match?: StartedMatch;
  message?: string;
};

const RECONNECT_MS = 1800;
const PING_MS = 10_000;

export function useLobbyPresence({ enabled, address, monsterName = 'Legend', level = 1 }: UseLobbyPresenceOptions) {
  const [connectionState, setConnectionState] = useState<LobbyConnectionState>('closed');
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [openMatches, setOpenMatches] = useState<LobbyOpenMatch[]>([]);
  const [invites, setInvites] = useState<LobbyInvite[]>([]);
  const [recentMatches, setRecentMatches] = useState<LobbyRecentMatch[]>([]);
  const [startedMatch, setStartedMatch] = useState<StartedMatch | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const endpoint = useMemo(() => buildArenaSocketUrl('/lobby'), []);

  const send = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const cleanupTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !address) {
      cleanupTimers();
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState('closed');
      return;
    }

    closedRef.current = false;

    const connect = () => {
      setConnectionState('connecting');
      const socket = new WebSocket(endpoint);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        setConnectionState('open');
        setLastError(null);
        socket.send(
          JSON.stringify({
            type: 'join',
            address,
            monsterName,
            level,
          })
        );
        pingTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_MS);
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as LobbyEnvelope;
          if (payload.type === 'lobbyState') {
            setPlayers(payload.players ?? []);
            setOpenMatches(payload.openMatches ?? []);
            setInvites(payload.invites ?? []);
            setRecentMatches(payload.recentMatches ?? []);
            return;
          }
          if (payload.type === 'invite' && payload.invite) {
            setInvites((current) => {
              const next = [...current.filter((invite) => invite.id !== payload.invite?.id), payload.invite!];
              return next.sort((a, b) => b.createdAt - a.createdAt);
            });
            return;
          }
          if (payload.type === 'matchStarted' && payload.match) {
            setStartedMatch(payload.match);
            return;
          }
          if (payload.type === 'error') {
            setLastError(payload.message ?? 'Lobby socket error');
            setConnectionState('error');
          }
        } catch {
          setLastError('Bad lobby payload');
          setConnectionState('error');
        }
      });

      socket.addEventListener('close', () => {
        cleanupTimers();
        if (closedRef.current) {
          setConnectionState('closed');
          return;
        }
        setConnectionState('error');
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_MS);
      });

      socket.addEventListener('error', () => {
        setLastError(`Lobby socket failed: ${endpoint}`);
        setConnectionState('error');
      });
    };

    connect();

    return () => {
      closedRef.current = true;
      cleanupTimers();
      send({ type: 'leave', address });
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [address, cleanupTimers, enabled, endpoint, level, monsterName, send]);

  const invitePlayer = useCallback(
    (to: string, roomId: string) => {
      if (!address) return;
      send({ type: 'invite', from: address, to, roomId });
    },
    [address, send]
  );

  const postOpenMatch = useCallback(
    (stakeSui: string, fallbackMatchId?: string) => {
      if (!address) return;
      send({
        type: 'matchCreated',
        creator: address,
        stakeSui,
        matchId: fallbackMatchId,
        monsterName,
        level,
      });
    },
    [address, level, monsterName, send]
  );

  const announceMatchStarted = useCallback(
    (input: { from: string; to: string; roomId?: string; openMatchId?: string; inviteId?: string; matchId?: string }) => {
      send({ type: 'matchStarted', ...input });
    },
    [send]
  );

  const clearStartedMatch = useCallback(() => {
    setStartedMatch(null);
  }, []);

  return {
    endpoint,
    connectionState,
    isConnected: connectionState === 'open',
    players,
    openMatches,
    invites,
    recentMatches,
    startedMatch,
    lastError,
    invitePlayer,
    postOpenMatch,
    announceMatchStarted,
    clearStartedMatch,
  };
}
