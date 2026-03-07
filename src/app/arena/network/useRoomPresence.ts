import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildArenaSocketUrl } from './socket';
import type { LobbyConnectionState, RoomChatMessage, RoomNotice, RoomParticipant, RoomState } from './types';

type UseRoomPresenceOptions = {
  enabled: boolean;
  roomId?: string;
  address?: string;
  spectator?: boolean;
};

type RoomEnvelope = {
  type?: string;
  room?: RoomState;
  message?: string;
};

const RECONNECT_MS = 1800;
const PING_MS = 5_000;
const VIEWER_STORAGE_KEY = 'anavrinArenaViewerId';

function ensureViewerId(): string {
  if (typeof window === 'undefined') {
    return `viewer_${crypto.randomUUID()}`;
  }

  const existing = window.localStorage.getItem(VIEWER_STORAGE_KEY);
  if (existing) return existing;

  const created = `viewer_${crypto.randomUUID()}`;
  window.localStorage.setItem(VIEWER_STORAGE_KEY, created);
  return created;
}

export function useRoomPresence({ enabled, roomId, address, spectator = false }: UseRoomPresenceOptions) {
  const [connectionState, setConnectionState] = useState<LobbyConnectionState>('closed');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [roomReady, setRoomReady] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const viewerIdRef = useRef('');
  const endpoint = useMemo(() => (roomId ? buildArenaSocketUrl(`/ws/room/${roomId}`) : ''), [roomId]);

  if (!viewerIdRef.current) {
    viewerIdRef.current = ensureViewerId();
  }

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
    if (!enabled || !roomId || (!address && !spectator)) {
      cleanupTimers();
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState('closed');
      setParticipants([]);
      setNotices([]);
      setMessages([]);
      setRoomReady(false);
      setViewerCount(0);
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
        if (spectator || !address) {
          socket.send(JSON.stringify({ type: 'joinSpectator', viewerId: viewerIdRef.current, address }));
        } else {
          socket.send(JSON.stringify({ type: 'joinRoom', address }));
        }
        pingTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_MS);
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as RoomEnvelope;
          if (payload.type === 'roomState' && payload.room) {
            setParticipants(payload.room.participants ?? []);
            setNotices(payload.room.notices ?? []);
            setMessages(payload.room.messages ?? []);
            setRoomReady(Boolean(payload.room.roomReady));
            setViewerCount(payload.room.viewerCount ?? 0);
            return;
          }
          if (payload.type === 'error') {
            setLastError(payload.message ?? 'Room socket error');
            setConnectionState('error');
          }
        } catch {
          setLastError('Bad room payload');
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
        setLastError(`Room socket failed: ${endpoint}`);
        setConnectionState('error');
      });
    };

    connect();

    return () => {
      closedRef.current = true;
      cleanupTimers();
      if (spectator || !address) {
        send({ type: 'leaveSpectator', viewerId: viewerIdRef.current });
      } else {
        send({ type: 'leaveRoom', address });
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [address, cleanupTimers, enabled, endpoint, roomId, send, spectator]);

  const setSelection = useCallback(
    (input: { monsterId?: string; monsterName?: string; stage?: number }) => {
      if (!address || spectator) return;
      send({ type: 'roomSelect', address, ...input });
    },
    [address, send, spectator]
  );

  const setStake = useCallback(
    (stakeSui: string) => {
      if (!address || spectator) return;
      send({ type: 'roomStake', address, stakeSui });
    },
    [address, send, spectator]
  );

  const setReady = useCallback(
    (ready: boolean) => {
      if (!address || spectator) return;
      send({ type: 'roomReady', address, ready });
    },
    [address, send, spectator]
  );

  const sendChat = useCallback(
    (text: string) => {
      if (!address || spectator) return false;
      return send({ type: 'roomChat', address, text });
    },
    [address, send, spectator]
  );

  return {
    endpoint,
    connectionState,
    isConnected: connectionState === 'open',
    participants,
    notices,
    messages,
    roomReady,
    viewerCount,
    lastError,
    setSelection,
    setStake,
    setReady,
    sendChat,
  };
}
