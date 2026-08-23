import { io, Socket } from 'socket.io-client';
import { useAuthStore, useSeatMapStore, SeatData } from '../store';

const defaultSocketUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000'
  : 'https://townhsll-backend.onrender.com';

const rawSocketUrl = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const SOCKET_URL = rawSocketUrl
  ? rawSocketUrl.replace(/\/+$/, '')
  : (rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api\/?$/, '') : defaultSocketUrl);

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[socket] Connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] Connection error:', err.message);
    });

    // Real-time seat status delta update
    socket.on('seat:update', ({ showSeatId, status, heldByMe }: {
      showId: string;
      showSeatId: string;
      status: SeatData['status'];
      heldByMe?: boolean;
    }) => {
      const store = useSeatMapStore.getState();
      const existing = store.seats[showSeatId];
      if (existing) {
        store.updateSeat(showSeatId, {
          status,
          held_by_me: heldByMe ?? (status === 'available' ? false : existing.held_by_me),
          hold_expires_at: status === 'available' ? null : existing.hold_expires_at,
        });
      }

      // If one of our held seats was released externally (TTL), clean up local state
      if (status === 'available') {
        store.removeHeld(showSeatId);
      }
    });

    // Full seat map snapshot (sent on join-show or reconnect)
    socket.on('seat-map:snapshot', ({ seats }: { showId: string; seats: SeatData[] }) => {
      useSeatMapStore.getState().setSeats(seats);
    });
  }

  return socket;
}

export function joinShow(showId: string) {
  getSocket().emit('join-show', showId);
}

export function leaveShow(showId: string) {
  getSocket().emit('leave-show', showId);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
