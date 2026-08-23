import { env } from './env';

export const HOLD_TTL_SECONDS = env.HOLD_TTL_SECONDS;
export const WAITLIST_OFFER_TTL_SECONDS = env.WAITLIST_OFFER_TTL_SECONDS;
export const MAX_SEATS_PER_ORDER = env.MAX_SEATS_PER_ORDER;

/** Redis key for a seat hold. Expiry = HOLD_TTL_SECONDS */
export const holdRedisKey = (showSeatId: string) => `hold:${showSeatId}`;

/** Redis key for a waitlist offer hold (same pattern, shorter TTL) */
export const waitlistHoldRedisKey = (showSeatId: string) => `hold:${showSeatId}`;

/** Socket.io room for a show */
export const showRoom = (showId: string) => `show:${showId}`;

export const EVENT_TYPES = [
  'movie', 'concert', 'play', 'musical', 'opera', 'dance',
  'standup', 'sports', 'esports', 'festival', 'exhibition',
  'conference', 'workshop', 'magic', 'circus', 'other',
] as const;

export type EventType = typeof EVENT_TYPES[number];

export const HOLD_STATUSES = ['available', 'held', 'booked'] as const;
export type HoldStatus = typeof HOLD_STATUSES[number];

export const USER_ROLES = ['admin', 'organiser', 'customer'] as const;
export type UserRole = typeof USER_ROLES[number];

export const SHOW_STATUSES = ['draft', 'published', 'cancelled'] as const;
export type ShowStatus = typeof SHOW_STATUSES[number];

export const WAITLIST_ENTRY_STATUSES = ['waiting', 'offered', 'fulfilled', 'expired', 'removed'] as const;
export const WAITLIST_OFFER_STATUSES = ['pending', 'accepted', 'expired'] as const;

export const ORDER_STATUSES = ['confirmed', 'partially_cancelled', 'cancelled'] as const;
export const BOOKING_STATUSES = ['confirmed', 'cancelled'] as const;

/** Number of bcrypt rounds */
export const BCRYPT_ROUNDS = 12;

/** Booking ref length (nanoid) */
export const BOOKING_REF_LENGTH = 16;
