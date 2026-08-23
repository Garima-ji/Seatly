import axios from 'axios';
import { useAuthStore } from '../store';

const defaultApiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000/api'
  : 'https://townhsll-backend.onrender.com/api';

const rawApiUrl = ((import.meta.env.VITE_API_URL as string | undefined) || defaultApiUrl).trim();
const cleanApiUrl = rawApiUrl.replace(/\/+$/, '');
const API_URL = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { refreshToken } = useAuthStore.getState();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        useAuthStore.getState().setAuth(
          useAuthStore.getState().user!,
          data.accessToken,
          data.refreshToken
        );

        failedQueue.forEach(({ resolve }) => resolve(null));
        failedQueue = [];
        return api(originalRequest);
      } catch {
        failedQueue.forEach(({ reject }) => reject(error));
        failedQueue = [];
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Typed API helpers ────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { full_name: string; email: string; phone: string; password: string; role?: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.post('/auth/verify-email', { token }).then((r) => r.data),
  resendVerification: (email: string) =>
    api.post('/auth/resend-verification', { email }).then((r) => r.data),
  googleAuth: (data: { credential?: string; idToken?: string; role?: string }) =>
    api.post('/auth/google', data).then((r) => r.data),
  linkGoogle: (data: { credential?: string; idToken?: string }) =>
    api.post('/auth/google/link', data).then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  preferences: (dark_mode_pref: boolean) =>
    api.patch('/auth/preferences', { dark_mode_pref }).then((r) => r.data),
};

export const eventsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/events', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/events/${id}`).then((r) => r.data),
  seatmap: (showId: string) =>
    api.get(`/events/shows/${showId}/seatmap`).then((r) => r.data),
};

export const customerApi = {
  createHold: (show_seat_id: string) =>
    api.post('/customer/holds', { show_seat_id }).then((r) => r.data),
  releaseHold: (holdId: string) =>
    api.delete(`/customer/holds/${holdId}`).then((r) => r.data),
  getHolds: (showId: string) =>
    api.get(`/customer/holds/${showId}`).then((r) => r.data),
  confirmOrder: (hold_ids: string[]) =>
    api.post('/customer/orders', { hold_ids }).then((r) => r.data),
  getOrders: () => api.get('/customer/orders').then((r) => r.data),
  getOrder: (id: string) => api.get(`/customer/orders/${id}`).then((r) => r.data),
  cancelBooking: (bookingId: string) =>
    api.delete(`/customer/bookings/${bookingId}`).then((r) => r.data),
  joinWaitlist: (showId: string, category_id: string) =>
    api.post(`/customer/shows/${showId}/waitlist`, { category_id }).then((r) => r.data),
  getWaitlistStatus: (showId: string, categoryId: string) =>
    api.get(`/customer/shows/${showId}/waitlist`, { params: { category_id: categoryId } }).then((r) => r.data),
};

export const adminApi = {
  createVenue: (data: { name: string; address: string; city: string }) =>
    api.post('/admin/venues', data).then((r) => r.data),
  getVenues: () => api.get('/admin/venues').then((r) => r.data),
  updateVenue: (id: string, data: Partial<{ name: string; address: string; city: string }>) =>
    api.put(`/admin/venues/${id}`, data).then((r) => r.data),
  deleteVenue: (id: string) => api.delete(`/admin/venues/${id}`).then((r) => r.data),
  createCategory: (venueId: string, data: { name: string; color_hex: string; display_order?: number }) =>
    api.post(`/admin/venues/${venueId}/seat-categories`, data).then((r) => r.data),
  getCategories: (venueId: string) =>
    api.get(`/admin/venues/${venueId}/seat-categories`).then((r) => r.data),
  updateCategory: (id: string, data: Partial<{ name: string; color_hex: string }>) =>
    api.put(`/admin/seat-categories/${id}`, data).then((r) => r.data),
  createSeats: (venueId: string, seats: { row_label: string; seat_number: number; category_id: string; is_aisle?: boolean }[]) =>
    api.post(`/admin/venues/${venueId}/seats`, { seats }).then((r) => r.data),
  getSeats: (venueId: string) =>
    api.get(`/admin/venues/${venueId}/seats`).then((r) => r.data),
};

export const organiserApi = {
  getVenues: () => api.get('/organiser/venues').then((r) => r.data),
  getVenue: (id: string) => api.get(`/organiser/venues/${id}`).then((r) => r.data),
  createEvent: (data: { venue_id: string; title: string; description?: string; type: string; poster_url?: string }) =>
    api.post('/organiser/events', data).then((r) => r.data),
  getEvents: () => api.get('/organiser/events').then((r) => r.data),
  updateEvent: (id: string, data: Partial<{ title: string; description: string; type: string }>) =>
    api.put(`/organiser/events/${id}`, data).then((r) => r.data),
  createShow: (eventId: string, data: { starts_at: string; ends_at: string }) =>
    api.post(`/organiser/events/${eventId}/shows`, data).then((r) => r.data),
  updateShowStatus: (showId: string, status: string) =>
    api.patch(`/organiser/shows/${showId}/status`, { status }).then((r) => r.data),
  updatePricing: (showId: string, prices: { category_id: string; price: number }[]) =>
    api.put(`/organiser/shows/${showId}/pricing`, { prices }).then((r) => r.data),
  getSummary: (eventId: string) =>
    api.get(`/organiser/events/${eventId}/summary`).then((r) => r.data),
};

export const waitlistApi = {
  acceptOffer: (offerId: string, token: string) =>
    api.get(`/waitlist/accept/${offerId}`, { params: { token } }).then((r) => r.data),
  myWaitlists: () => api.get('/waitlist/my').then((r) => r.data),
};
