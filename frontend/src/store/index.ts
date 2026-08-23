import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'admin' | 'organiser' | 'customer';
  dark_mode_pref: boolean;
  email_verified?: boolean;
  google_id?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        useThemeStore.getState().set(user.dark_mode_pref);
      },
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    { name: 'auth-storage' }
  )
);

// ─── Theme Store ──────────────────────────────────────────────────────────────

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  set: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false,
      toggle: () =>
        set((state) => {
          const next = !state.isDark;
          applyTheme(next);
          // If logged in with active token, sync with backend
          const { user: authUser, accessToken } = useAuthStore.getState();
          if (authUser && accessToken) {
            authApi.preferences(next).catch(() => {});
            useAuthStore.getState().updateUser({ dark_mode_pref: next });
          }
          return { isDark: next };
        }),
      set: (dark) => {
        applyTheme(dark);
        set({ isDark: dark });
      },
    }),
    { name: 'theme-storage' }
  )
);

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Initialize theme on load
const { isDark } = useThemeStore.getState();
applyTheme(isDark);

// ─── Seat Map Store ───────────────────────────────────────────────────────────

export interface SeatData {
  show_seat_id: string;
  seat_id: string;
  status: 'available' | 'held' | 'booked';
  row_label: string;
  seat_number: number;
  is_aisle: boolean;
  category_id: string;
  category_name: string;
  color_hex: string;
  price: number;
  held_by_me: boolean;
  hold_expires_at: string | null;
  category_sold_out: boolean;
}

interface SeatMapState {
  showId: string | null;
  seats: Record<string, SeatData>; // keyed by show_seat_id
  selectedSeatIds: Set<string>;    // pre-hold selected seats
  heldSeatIds: Set<string>;        // confirmed holds by current user
  setShowId: (id: string) => void;
  setSeats: (seats: SeatData[]) => void;
  updateSeat: (showSeatId: string, update: Partial<SeatData>) => void;
  toggleSelect: (showSeatId: string) => void;
  addHeld: (showSeatId: string) => void;
  removeHeld: (showSeatId: string) => void;
  clearSelections: () => void;
}

export const useSeatMapStore = create<SeatMapState>((set, get) => ({
  showId: null,
  seats: {},
  selectedSeatIds: new Set(),
  heldSeatIds: new Set(),
  setShowId: (id) => set({ showId: id }),
  setSeats: (seats) => {
    const map: Record<string, SeatData> = {};
    for (const s of seats) map[s.show_seat_id] = s;
    set({ seats: map });
  },
  updateSeat: (showSeatId, update) =>
    set((state) => ({
      seats: {
        ...state.seats,
        [showSeatId]: { ...state.seats[showSeatId], ...update },
      },
    })),
  toggleSelect: (showSeatId) =>
    set((state) => {
      const next = new Set(state.selectedSeatIds);
      if (next.has(showSeatId)) {
        next.delete(showSeatId);
      } else {
        next.add(showSeatId);
      }
      return { selectedSeatIds: next };
    }),
  addHeld: (showSeatId) =>
    set((state) => {
      const next = new Set(state.heldSeatIds);
      next.add(showSeatId);
      const sel = new Set(state.selectedSeatIds);
      sel.delete(showSeatId);
      return { heldSeatIds: next, selectedSeatIds: sel };
    }),
  removeHeld: (showSeatId) =>
    set((state) => {
      const next = new Set(state.heldSeatIds);
      next.delete(showSeatId);
      return { heldSeatIds: next };
    }),
  clearSelections: () => set({ selectedSeatIds: new Set() }),
}));
