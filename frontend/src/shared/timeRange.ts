export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

export interface DateRangeValue {
  startDate: string;
  endDate: string;
}

interface DateTimeParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function getShanghaiParts(date = new Date()): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === '24' ? '00' : map.hour,
    minute: map.minute,
  };
}

export function getShanghaiDateInput(date = new Date()): string {
  const parts = getShanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getShanghaiTimeInput(date = new Date()): string {
  const parts = getShanghaiParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function addDays(dateInput: string, days: number): string {
  const [year, month, day] = dateInput.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function calendarWeekday(dateInput: string): number {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function toShanghaiIso(dateValue: string, timeValue: string, endOfMinute = false): string {
  if (!dateValue) return '';
  const time = timeValue || (endOfMinute ? '23:59' : '00:00');
  return `${dateValue}T${time}:${endOfMinute ? '59' : '00'}+08:00`;
}

export function parseShanghaiDateTimeValue(value: string | null | undefined): { date: string; time: string } | null {
  if (!value) return null;
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (direct) return { date: direct[1], time: direct[2] };

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    date: getShanghaiDateInput(parsed),
    time: getShanghaiTimeInput(parsed),
  };
}

export function getShanghaiTodayRange(): DateRangeValue {
  const today = getShanghaiDateInput();
  return {
    startDate: toShanghaiIso(today, '00:00'),
    endDate: toShanghaiIso(today, getShanghaiTimeInput(), true),
  };
}

export function getShanghaiYesterdayRange(): DateRangeValue {
  const yesterday = addDays(getShanghaiDateInput(), -1);
  return {
    startDate: toShanghaiIso(yesterday, '00:00'),
    endDate: toShanghaiIso(yesterday, '23:59', true),
  };
}

export function getShanghaiRecentDaysRange(days: number): DateRangeValue {
  const today = getShanghaiDateInput();
  const start = addDays(today, -Math.max(1, days) + 1);
  return {
    startDate: toShanghaiIso(start, '00:00'),
    endDate: toShanghaiIso(today, getShanghaiTimeInput(), true),
  };
}

export function getShanghaiWeekRange(): DateRangeValue {
  const today = getShanghaiDateInput();
  const weekday = calendarWeekday(today);
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return {
    startDate: toShanghaiIso(addDays(today, diffToMonday), '00:00'),
    endDate: toShanghaiIso(today, getShanghaiTimeInput(), true),
  };
}

function formatShort(value: string): string {
  const parsed = parseShanghaiDateTimeValue(value);
  if (!parsed) return '';
  const [, month, day] = parsed.date.split('-');
  return `${month}/${day} ${parsed.time}`;
}

export function formatShanghaiRangeLabel(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return '选择时间范围';
  if (startDate && endDate) return `${formatShort(startDate)} - ${formatShort(endDate)}`;
  if (startDate) return `从 ${formatShort(startDate)}`;
  return `至 ${formatShort(endDate)}`;
}
