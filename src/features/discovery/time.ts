import type { DiscoveryFilters } from './filters';

type Schedule = { weekday: number; opens_at: string; closes_at: string; valid_from: string | null; valid_until: string | null };
type TimedExperience = { starts_at: string | null; ends_at: string | null; schedules: Schedule[] };

const karachi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
const weekdayNumber: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const offsetMs = 5 * 60 * 60 * 1000; // Asia/Karachi has UTC+05:00 and no daylight saving time.

function localDay(instant: Date) {
  const parts = Object.fromEntries(karachi.formatToParts(instant).map(({ type, value }) => [type, value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  return { midnight: Date.UTC(year, month - 1, day) - offsetMs, weekday: weekdayNumber[parts.weekday] };
}

export function selectedWindow(when: DiscoveryFilters['when'], now: Date) {
  if (!when) return null;
  const today = localDay(now);
  const day = 24 * 60 * 60 * 1000;
  if (when === 'tonight') return { start: Math.max(today.midnight + 18 * 60 * 60 * 1000, now.getTime()), end: today.midnight + day };
  if (when === 'tomorrow') return { start: today.midnight + day, end: today.midnight + 2 * day };
  const daysUntilSaturday = (6 - today.weekday + 7) % 7;
  const start = today.weekday === 0 ? today.midnight : today.midnight + daysUntilSaturday * day;
  return { start: Math.max(start, now.getTime()), end: start + (today.weekday === 0 ? day : 2 * day) };
}

export function matchesWindow(item: TimedExperience, window: ReturnType<typeof selectedWindow>) {
  if (!window) return true;
  if (window.start >= window.end) return false;
  const dated = item.starts_at && item.ends_at;
  const datedOverlap = dated && Date.parse(item.starts_at!) < window.end && Date.parse(item.ends_at!) > window.start;
  if (dated && !datedOverlap) return false;
  if (!item.schedules.length) return Boolean(datedOverlap);
  const day = 24 * 60 * 60 * 1000;
  for (let start = localDay(new Date(window.start)).midnight; start < window.end; start += day) {
    const local = localDay(new Date(start + 12 * 60 * 60 * 1000));
    const localDate = new Date(local.midnight + offsetMs).toISOString().slice(0, 10);
    for (const slot of item.schedules) {
      if (slot.weekday !== local.weekday || (slot.valid_from && slot.valid_from > localDate) || (slot.valid_until && slot.valid_until < localDate)) continue;
      const opens = local.midnight + timeMs(slot.opens_at);
      const closes = local.midnight + timeMs(slot.closes_at);
      if (opens < window.end && closes > window.start) return true;
    }
  }
  return false;
}

function timeMs(value: string) {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return ((hours * 60 + minutes) * 60 + (seconds || 0)) * 1000;
}
