const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_MINUTE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATETIME_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const HAS_TIMEZONE_RE = /(?:Z|[+-]\d{2}:\d{2})$/i;
const BEIJING_TIME_ZONE = 'Asia/Shanghai';

function pad(value) {
  return String(value).padStart(2, '0');
}

function getBeijingParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIME_ZONE,
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
  };
}

function calendarWeekday(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addCalendarDays(year, month, day, days) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function beijingMidnight({ year, month, day }) {
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00+08:00`);
}

function getBeijingDateKey(date = new Date()) {
  const parts = getBeijingParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getBeijingWeekKey(dateKey = getBeijingDateKey()) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const weekday = calendarWeekday(year, month, day);
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addCalendarDays(year, month, day, diffToMonday);
  return `${weekStart.year}-${pad(weekStart.month)}-${pad(weekStart.day)}`;
}

function getBeijingMonthKey(dateKey = getBeijingDateKey()) {
  return String(dateKey).slice(0, 7);
}

function normalizeBeijingDateParam(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (HAS_TIMEZONE_RE.test(text)) return text;
  if (DATE_ONLY_RE.test(text)) return `${text}T00:00:00+08:00`;
  if (DATETIME_MINUTE_RE.test(text)) return `${text}:00+08:00`;
  if (DATETIME_SECOND_RE.test(text)) return `${text}+08:00`;
  return text;
}

function parseBeijingDateParam(value, fieldName) {
  if (!value) return { value: null };
  const date = new Date(normalizeBeijingDateParam(value));
  if (Number.isNaN(date.getTime())) {
    return { error: `${fieldName} 必须是有效日期` };
  }
  return { value: date };
}

function getBeijingDayStart(date = new Date()) {
  const parts = getBeijingParts(date);
  return beijingMidnight({
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  });
}

function getBeijingWeekStart(date = new Date()) {
  const parts = getBeijingParts(date);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const weekday = calendarWeekday(year, month, day);
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return beijingMidnight(addCalendarDays(year, month, day, diffToMonday));
}

module.exports = {
  getBeijingDateKey,
  getBeijingDayStart,
  getBeijingMonthKey,
  getBeijingWeekKey,
  getBeijingWeekStart,
  normalizeBeijingDateParam,
  parseBeijingDateParam,
};
