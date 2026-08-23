/**
 * Display utilities for IST dates and INR currency.
 */

const IST_LOCALE = 'en-IN';
const IST_TIMEZONE = 'Asia/Kolkata';

export function formatIST(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return (
    d.toLocaleString(IST_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' IST'
  );
}

export function formatISTDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatISTTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(IST_LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a number as INR rupees.
 * Always shows 2 decimal places if any paise, else shows whole rupees.
 */
export function formatINR(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '₹0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toFixed(2)}`;
}
