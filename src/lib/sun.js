// Sunrise and sunset, worked out on the visitor's phone from the place and the date (NOAA formula).
// Nothing goes over the network and nothing is stored.

import { isDate } from "./dates.js";

const rad = (value) => (value * Math.PI) / 180;
const deg = (value) => (value * 180) / Math.PI;
const ZENITH = 90.833;
const formatters = new Map();

// "YYYY-MM-DD HH:MM" on the wall clocks of a time zone.
export function wallClock(now, timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
  }
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function localMinutes(date, utcMidnight, minutesAfter, timeZone) {
  // Half a minute added so the result rounds to the nearest minute.
  const [wallDate, time] = wallClock(new Date(utcMidnight + minutesAfter * 60000 + 30000), timeZone).split(" ");
  const [hour, minute] = time.split(":").map(Number);
  const dayShift = (Date.parse(`${wallDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000;
  return { minutes: hour * 60 + minute + dayShift * 1440, time };
}

// Local wall-clock minutes of sunrise and sunset at [lon, lat] on `date`, or null.
export function sunTimes({ ll, tz, date }) {
  if (!Array.isArray(ll) || typeof tz !== "string" || !tz || !isDate(date)) return null;
  const [lon, lat] = ll;
  const [year, month, day] = date.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const T = ((utcMidnight + 43200000) / 86400000 + 2440587.5 - 2451545) / 36525;
  const meanLongitude = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const anomaly = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const eccentricity = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const center = Math.sin(rad(anomaly)) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(rad(2 * anomaly)) * (0.019993 - 0.000101 * T)
    + Math.sin(rad(3 * anomaly)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const longitude = meanLongitude + center - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const obliquity = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(rad(omega));
  const declination = Math.asin(Math.sin(rad(obliquity)) * Math.sin(rad(longitude)));
  const y = Math.tan(rad(obliquity / 2)) ** 2;
  const equationOfTime = 4 * deg(
    y * Math.sin(rad(2 * meanLongitude))
    - 2 * eccentricity * Math.sin(rad(anomaly))
    + 4 * eccentricity * y * Math.sin(rad(anomaly)) * Math.cos(rad(2 * meanLongitude))
    - 0.5 * y * y * Math.sin(rad(4 * meanLongitude))
    - 1.25 * eccentricity * eccentricity * Math.sin(rad(2 * anomaly)),
  );
  const cosHour = Math.cos(rad(ZENITH)) / (Math.cos(rad(lat)) * Math.cos(declination)) - Math.tan(rad(lat)) * Math.tan(declination);
  if (cosHour < -1 || cosHour > 1) return null;
  const hourAngle = deg(Math.acos(cosHour));
  const solarNoon = 720 - 4 * lon - equationOfTime;
  const rise = localMinutes(date, utcMidnight, solarNoon - 4 * hourAngle, tz);
  const set = localMinutes(date, utcMidnight, solarNoon + 4 * hourAngle, tz);
  return { rise: rise.minutes, set: set.minutes, riseTime: rise.time, setTime: set.time };
}
