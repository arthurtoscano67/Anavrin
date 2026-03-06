import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  detectSameOriginHtmlLobby,
  INITIAL_RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS,
  PING_INTERVAL_MS,
  resolveEndpoint,
} from './websocket';

export type LobbyPlayer = {
  address: string;
  monsterName: string;
  level: number;
  joinedAt: number;
  lastSeen: number;
};

export type LobbyOpenMatch = {
  id: string;
  creator: string;
  creatorMonster: string;
  creatorLevel: number;
  stakeSui: string;
  createdAt: number;
};

export type LobbyInvite = {
  id: string;
  from: string;
  to: string;
  monsterName: string;
  level: number;
  createdAt: number;
  status: 'pending' | 'accepted' | 'declined';
};

export type LobbyRecentMatch = {
  id: string;
  summary: string;
  timestamp: number;
};

export type LobbyStartedMatch = {
  id: string;
  from: string;
  to: string;
  openMatchId?: string;
  inviteId?: string;
  matchId?: string;
  startedAt: number;
};

export type LobbyConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type UseArenaPresenceResult = {
  connectionState: LobbyConnectionState;
  isConnected: boolean;
  endpoint: string;
  players: LobbyPlayer[];
  openMatches: LobbyOpenMatch[];
  invites: LobbyInvite[];
  recentMatches: LobbyRecentMatch[];
  pendingMatchStart: LobbyStartedMatch | null;
  lastError: string | null;
  invitePlayer: (to: string) => void;
  createOpenMatch: (stakeSui: string) => void;
  joinOpenMatch: (matchId: string, creatorAddress: string) => void;
  acceptInvite: (invite: LobbyInvite) => void;
  announceMatchCreated: (payload: { matchId: string; opponent?: string; stakeSui?: string }) => void;
  clearPendingMatchStart: () => void;
};

type UseArenaPresenceOptions = {
  enabled?: boolean;
  endpoint?: string;
  address?: string;
  monsterName?: string;
  level?: number;
};

type LobbyStateMessage = {
  type: 'lobbyState';
  players?: LobbyPlayer[];
  openMatches?: LobbyOpenMatch[];
  invites?: LobbyInvite[];
  recentMatches?: LobbyRecentMatch[];
};

type InviteMessage = {
  type: 'invite';
  invite: LobbyInvite;
};

type MatchStartedMessage = {
  type: 'matchStarted';
  match: LobbyStartedMatch;
};

type ErrorMessage = {
  type: 'error';
  message?: string;
};

type ServerMessage = LobbyStateMessage | InviteMessage | MatchStartedMessage | ErrorMessage;

function safeParseMessage(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    return null;
  }
}

function upsertInvite(invites: LobbyInvite[], invite: LobbyInvite): LobbyInvite[] {
  const idx = invites.findIndex((entry) => entry.id === invite.id);
  if (idx === -1) return [invite, ...invites];
  const next = [...invites];
  next[idx] = invite;
  return next;
}

export function useArenaPresence(options: UseArenaPresenceOptions): UseArenaPresenceResult {
  const {
    enabled = true,
    endpoint: explicitEndpoint,
    address,
    monsterName = 'Unknown',
    level = 1,
  } = options;

  const endpoint = useMemo(() => resolveEndpoint(explicitEndpoint), [explicitEndpoint]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | undefined>(undefined);
  const pingTimerRef = useRef<number | undefined>(undefined);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const blockedEndpointRef = useRef<string | null>(null);
  const hasConnectedRef = useRef(false);

  const [connectionState, setConnectionState] = useState<LobbyConnectionState>('idle');
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [openMatches, setOpenMatches] = useState<LobbyOpenMatch[]>([]);
  const [invites, setInvites] = useState<LobbyInvite[]>([]);
  const [recentMatches, setRecentMatches] = useState<LobbyRecentMatch[]>([]);
  const [pendingMatchStart, setPendingMatchStart] = useState<LobbyStartedMatch | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== undefined) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = undefined;
    }
  }, []);

  const clearPingTimer = useCallback(() => {
    if (pingTimerRef.current !== undefined) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = undefined;
    }
  }, []);

  const sendRaw = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const sendJoin = useCallback(() => {
    if (!address) return;
    sendRaw({ type: 'join', address, monsterName, level });
  }, [address, level, monsterName, sendRaw]);

  const scheduleReconnect = useCallback((connect: () => void) => {
    if (!shouldReconnectRef.current || !enabled || !address || !endpoint || blockedEndpointRef.current === endpoint) {
      return;
    }

    clearReconnectTimer();
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, INITIAL_RECONNECT_DELAY_MS * 2 ** attempt);
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectAttemptRef.current += 1;
      connect();
    }, delay);
  }, [address, clearReconnectTimer, enabled, endpoint]);

  const connect = useCallback(() => {
    if (!enabled || !address || !endpoint) {
      setConnectionState('idle');
      return;
    }

    const previous = wsRef.current;
    if (previous && previous.readyState <= WebSocket.OPEN) {
      previous.close(1000, 'reconnect');
    }

    setConnectionState('connecting');
    setLastError(null);

    const ws = new WebSocket(endpoint);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      reconnectAttemptRef.current = 0;
      hasConnectedRef.current = true;
      setConnectionState('open');
      sendJoin();
      clearPingTimer();
      pingTimerRef.current = window.setInterval(() => {
        sendRaw({ type: 'ping' });
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const parsed = safeParseMessage(event.data);
      if (!parsed) return;

      if (parsed.type === 'lobbyState') {
        setPlayers(Array.isArray(parsed.players) ? parsed.players : []);
        setOpenMatches(Array.isArray(parsed.openMatches) ? parsed.openMatches : []);
        setInvites(Array.isArray(parsed.invites) ? parsed.invites : []);
        setRecentMatches(Array.isArray(parsed.recentMatches) ? parsed.recentMatches : []);
        return;
      }

      if (parsed.type === 'invite') {
        setInvites((prev) => upsertInvite(prev, parsed.invite));
        return;
      }

      if (parsed.type === 'matchStarted') {
        setPendingMatchStart(parsed.match);
        setRecentMatches((prev) => {
          const exists = prev.some((entry) => entry.id === parsed.match.id);
          if (exists) return prev;
          return [
            {
              id: parsed.match.id,
              summary: `Lobby duel ready: ${parsed.match.from.slice(0, 6)}... vs ${parsed.match.to.slice(0, 6)}...`,
              timestamp: parsed.match.startedAt,
            },
            ...prev,
          ].slice(0, 20);
        });
        return;
      }

      if (parsed.type === 'error') {
        setLastError(parsed.message || 'Lobby server error');
      }
    };

    ws.onerror = () => {
      setConnectionState('error');
      setLastError('Lobby connection error');
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      clearPingTimer();
      const shouldRetry = shouldReconnectRef.current && enabled && Boolean(address) && Boolean(endpoint);
      if (shouldRetry && hasConnectedRef.current) {
        setConnectionState('connecting');
      } else {
        setConnectionState('closed');
      }
      if (!lastError && !shouldRetry) {
        setLastError(`Lobby socket closed (${endpoint})`);
      }
      scheduleReconnect(connect);
    };
  }, [address, clearPingTimer, enabled, endpoint, lastError, scheduleReconnect, sendJoin, sendRaw]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    blockedEndpointRef.current = null;

    if (!enabled || !address || !endpoint) {
      setPlayers([]);
      setOpenMatches([]);
      setInvites([]);
      setRecentMatches([]);
      setConnectionState('idle');
      return () => {
        shouldReconnectRef.current = false;
      };
    }

    let cancelled = false;
    void (async () => {
      const misconfiguredError = await detectSameOriginHtmlLobby(endpoint);
      if (cancelled) return;
      if (misconfiguredError) {
        blockedEndpointRef.current = endpoint;
        setConnectionState('error');
        setLastError(misconfiguredError);
        return;
      }
      connect();
    })();

    return () => {
      cancelled = true;
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      clearPingTimer();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && address) {
        ws.send(JSON.stringify({ type: 'leave', address }));
      }
      if (ws) ws.close(1000, 'cleanup');
      wsRef.current = null;
    };
  }, [address, clearPingTimer, clearReconnectTimer, connect, enabled, endpoint]);

  useEffect(() => {
    if (connectionState !== 'open') return;
    sendJoin();
  }, [connectionState, sendJoin]);

  const invitePlayer = useCallback((to: string) => {
    if (!address || !to) return;
    sendRaw({ type: 'invite', from: address, to });
  }, [address, sendRaw]);

  const createOpenMatch = useCallback((stakeSui: string) => {
    if (!address) return;
    sendRaw({ type: 'matchCreated', creator: address, stakeSui, monsterName, level });
  }, [address, level, monsterName, sendRaw]);

  const joinOpenMatch = useCallback((matchId: string, creatorAddress: string) => {
    if (!address || !matchId || !creatorAddress) return;
    sendRaw({ type: 'matchStarted', from: address, to: creatorAddress, openMatchId: matchId });
  }, [address, sendRaw]);

  const acceptInvite = useCallback((invite: LobbyInvite) => {
    if (!address) return;
    sendRaw({ type: 'matchStarted', from: invite.from, to: invite.to, inviteId: invite.id });
  }, [address, sendRaw]);

  const announceMatchCreated = useCallback((payload: { matchId: string; opponent?: string; stakeSui?: string }) => {
    if (!address) return;
    sendRaw({
      type: 'matchCreated',
      creator: address,
      opponent: payload.opponent,
      matchId: payload.matchId,
      stakeSui: payload.stakeSui,
      monsterName,
      level,
    });
  }, [address, level, monsterName, sendRaw]);

  const clearPendingMatchStart = useCallback(() => {
    setPendingMatchStart(null);
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'open',
    endpoint,
    players,
    openMatches,
    invites,
    recentMatches,
    pendingMatchStart,
    lastError,
    invitePlayer,
    createOpenMatch,
    joinOpenMatch,
    acceptInvite,
    announceMatchCreated,
    clearPendingMatchStart,
  };
}
