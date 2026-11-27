// Calendar dates as "YYYY-MM-DD" strings, counted in whole days so time zones never shift a day.

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

// Text in that shape naming a day the calendar has (not 31 April, which Date.parse turns into 1 May).
export function isDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function addDays(date, count) {
  const time = Date.parse(`${date}T00:00:00Z`) + count * 86400000;
  return new Date(time).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function weekdayOf(date) {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

// Today on the visitor's own calendar.
export function localToday(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
