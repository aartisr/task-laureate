/**
 * Date-only values represent a calendar day, not an instant in time.
 *
 * Task due dates are stored by the API as PostgreSQL `date` values. Keeping
 * the `YYYY-MM-DD` representation at the UI boundary prevents a user's time
 * zone from silently moving the selected day during editing or display.
 */
const DATE_ONLY_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

export type DueDateState = 'overdue' | 'today' | 'upcoming' | 'none';

function isValidDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Returns a safe native-date-input value, or an empty value for no/invalid date. */
export function toDateInputValue(value: string | null | undefined): string {
  const candidate = value?.match(DATE_ONLY_PATTERN)?.[1];
  return candidate && isValidDateOnly(candidate) ? candidate : '';
}

/** Formats a due date as a local calendar day, never as a UTC instant. */
export function formatDateOnly(value: string | null | undefined, locales: Intl.LocalesArgument, options: Intl.DateTimeFormatOptions): string {
  const dateOnly = toDateInputValue(value);
  if (!dateOnly) return '';
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Intl.DateTimeFormat(locales, options).format(new Date(year, month - 1, day));
}

export function isDueDateBeforeToday(value: string | null | undefined, now = new Date()): boolean {
  return getDueDateState(value, now) === 'overdue';
}

export function isDueDateToday(value: string | null | undefined, now = new Date()): boolean {
  return getDueDateState(value, now) === 'today';
}

/**
 * Classifies a due date against the user's local calendar day. A due date has
 * no time-of-day, so it remains due today until the next local calendar day.
 */
export function getDueDateState(value: string | null | undefined, now = new Date()): DueDateState {
  const dateOnly = toDateInputValue(value);
  if (!dateOnly) return 'none';
  const today = localDate(0, now);
  if (dateOnly < today) return 'overdue';
  if (dateOnly === today) return 'today';
  return 'upcoming';
}

/** Creates a local calendar date suitable for a native `input[type=date]`. */
export function localDate(offsetDays = 0, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
