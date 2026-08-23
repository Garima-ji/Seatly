/**
 * IST (Indian Standard Time) date formatting utilities.
 * All DB timestamps are stored as UTC TIMESTAMPTZ.
 * All display strings are in IST (Asia/Kolkata, UTC+5:30).
 */

const IST_LOCALE = 'en-IN';
const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Format a Date (or ISO string) as a full IST datetime string.
 * e.g. "21 Aug 2026, 7:30 PM IST"
 */
export function formatIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' IST';
}

/**
 * Format a Date as IST date only.
 * e.g. "21 Aug 2026"
 */
export function formatISTDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a Date as IST time only.
 * e.g. "7:30 PM"
 */
export function formatISTTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Return an ISO string with IST offset (+05:30) for API responses.
 * Clients should use this string for countdown timers — not local clock.
 */
export function toISTISOString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Add 5h30m to UTC
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  // Replace the Z with +05:30
  return ist.toISOString().replace('Z', '+05:30');
}
