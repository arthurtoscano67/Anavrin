import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildArenaSocketUrl } from './socket';
import type { LobbyConnectionState, RoomParticipant, RoomState, RoomNotice } from './types';

type UseRoomPresenceOptions = {
  enabled: boolean;
  roomId?: string;
  address?: string;
};

type RoomEnvelope = {
  type?: string;
  room?: RoomState;
  message?: string;
};

const RECONNECT_MS = 1800;
const PING_MS = 10_000;

export function useRoomPresence({ enabled, roomId, address }: UseRoomPresenceOptions) {
  const [connectionState, setConnectionState] = useState<LobbyConnectionState>('closed');
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const [roomReady, setRoomReady] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const endpoint = useMemo(() => (roomId ? buildArenaSocketUrl(`/room/${roomId}`) : ''), [roomId]);

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
    if (!enabled || !roomId || !address) {
      cleanupTimers();
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState('closed');
      setParticipants([]);
      setNotices([]);
      setRoomReady(false);
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
        socket.send(JSON.stringify({ type: 'joinRoom', address }));
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
            setRoomReady(Boolean(payload.room.roomReady));
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
      send({ type: 'leaveRoom', address });
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [address, cleanupTimers, enabled, endpoint, roomId, send]);

  const setSelection = useCallback(
    (input: { monsterId?: string; monsterName?: string; stage?: number }) => {
      if (!address) return;
      send({ type: 'roomSelect', address, ...input });
    },
    [address, send]
  );

  const setStake = useCallback(
    (stakeSui: string) => {
      if (!address) return;
      send({ type: 'roomStake', address, stakeSui });
    },
    [address, send]
  );

  const setReady = useCallback(
    (ready: boolean) => {
      if (!address) return;
      send({ type: 'roomReady', address, ready });
    },
    [address, send]
  );

  return {
    endpoint,
    connectionState,
    isConnected: connectionState === 'open',
    participants,
    notices,
    roomReady,
    lastError,
    setSelection,
    setStake,
    setReady,
  };
}
