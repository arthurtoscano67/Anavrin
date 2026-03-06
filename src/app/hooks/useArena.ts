import { useCallback, useState } from 'react';

import { ACTIVE_ARENA_ROOM_STORAGE_KEY } from '../../server/arenaRooms';
import type { ArenaScreen } from '../arena/battle-engine/battleEngine';

function readStoredRoomId(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ACTIVE_ARENA_ROOM_STORAGE_KEY) ?? '';
}

export function useArena(initialMatchId: string, initialRoomId: string) {
  const initialRoom = initialRoomId || readStoredRoomId();
  const [screen, setScreen] = useState<ArenaScreen>(initialMatchId || initialRoom ? 'room' : 'lobby');
  const [currentMatchId, setCurrentMatchId] = useState(initialMatchId);
  const [currentRoomId, setCurrentRoomId] = useState(initialRoom);

  const persistRoomId = useCallback((roomId?: string | null) => {
    if (typeof window === 'undefined') return;
    if (roomId) {
      window.localStorage.setItem(ACTIVE_ARENA_ROOM_STORAGE_KEY, roomId);
      setCurrentRoomId(roomId);
      return;
    }
    window.localStorage.removeItem(ACTIVE_ARENA_ROOM_STORAGE_KEY);
    setCurrentRoomId('');
  }, []);

  return {
    screen,
    setScreen,
    currentMatchId,
    setCurrentMatchId,
    currentRoomId,
    setCurrentRoomId,
    persistRoomId,
  };
}
