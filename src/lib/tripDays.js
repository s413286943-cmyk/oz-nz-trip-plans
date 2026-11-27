// What the visitor's own plan looks like day by day: where each day is, its light, its weather,
// how long you drive, and on the road which day it is now and what comes next.
import { hop, placeName, placeOf } from "./compose.js";
import { addDays, localToday } from "./dates.js";
import { daySteps, dayTicks, stepMinutes } from "./light.js";
import { sunTimes, wallClock } from "./sun.js";
import { knownCountry, knownStopZone } from "./zones.js";

export { AU_ZONES } from "./zones.js";

const TZ = new Map([["nz", "Pacific/Auckland"], ["au", "Australia/Sydney"]]);

// The phone's own time zone: on the road, that is the time where the visitor is.
export function deviceZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// The place a day belongs to (a home day takes the last stop: that is where you leave from).
// `zoneFrom` says where the time zone came from: the place library, the stop's own choice, its
// country, or (a place elsewhere with no zone of its own) the phone.
export function placeOfDay(library, data, day, phoneZone = deviceZone()) {
  const stops = data.plan?.stops || [];
  const stop = stops.find((item) => item.key === day.stopKey) || (day.stopKey === "home" ? stops.at(-1) : null);
  const place = stop ? placeOf(library, stop.placeId) : null;
  const own = knownStopZone(stop?.tz);
  const country = TZ.get(knownCountry(stop?.country) || knownCountry(day.country)) || "";
  const tz = (typeof place?.tz === "string" && place.tz) || own || country || phoneZone;
  return {
    stop,
    place,
    name: stop ? placeName(library, stop) : "",
    ll: place?.ll || null,
    tz,
    zoneFrom: place?.tz ? "place" : own ? "stop" : country ? "country" : "device",
  };
}

export function daySun(library, data, day) {
  const where = placeOfDay(library, data, day);
  return day.date ? sunTimes({ ll: where.ll, tz: where.tz, date: day.date }) : null;
}

// A forecast if there is a fresh one for that day and place, else that month's ten-year average.
export function dayWeather(library, data, day, forecasts = {}) {
  if (!day.date) return null;
  const where = placeOfDay(library, data, day);
  const forecast = where.place && forecasts[`${where.place.id}:${day.date}`];
  if (forecast) return { kind: "forecast", ...forecast };
  const month = where.place?.climate?.[Number(day.date.slice(5, 7)) - 1];
  return month ? { kind: "normal", high: month.high, low: month.low, rain: month.rain } : null;
}

// Every WMO weather code Open-Meteo sends.
const WORDS = new Map([[0, "晴"], [1, "大致晴"], [2, "多云"], [3, "阴"], [45, "有雾"], [48, "有雾"], [51, "毛毛雨"], [53, "毛毛雨"], [55, "毛毛雨"], [56, "冻毛毛雨"], [57, "冻毛毛雨"], [61, "小雨"], [63, "中雨"], [65, "大雨"], [66, "冻雨"], [67, "冻雨"], [71, "小雪"], [73, "中雪"], [75, "大雪"], [77, "米雪"], [80, "阵雨"], [81, "阵雨"], [82, "强阵雨"], [85, "阵雪"], [86, "强阵雪"], [95, "雷阵雨"], [96, "雷阵雨"], [99, "雷阵雨"]]);
export const weatherWord = (code) => WORDS.get(code) || "";

export function weatherShort(weather) {
  if (!weather) return "";
  const range = `${weather.low}–${weather.high}°`;
  return weather.kind === "forecast" ? [weather.word, range].filter(Boolean).join(" ") : `约 ${range}`;
}

export function weatherLine(weather) {
  if (!weather) return "";
  const range = `${weather.low}–${weather.high}°C`;
  if (weather.kind === "normal") return `往年这个月约 ${range}，约 ${weather.rain}% 的日子下雨`;
  return `预报 ${[weather.word, range].filter(Boolean).join(" ")}${weather.rain === null || weather.rain === undefined ? "" : `，下雨概率 ${weather.rain}%`}`;
}

// One row per day for "every day's light".
export function lightRows(library, data, forecasts = {}) {
  return data.days.map((day, index) => {
    const where = placeOfDay(library, data, day);
    const next = data.days[index + 1];
    return {
      day,
      number: index + 1,
      town: day.stopKey === "home" ? "回程" : where.name,
      sun: daySun(library, data, day),
      ticks: dayTicks(day),
      weather: dayWeather(library, data, day, forecasts),
      endsStop: Boolean(next && next.stopKey !== day.stopKey),
    };
  });
}

// A route's stops for the map: where each is, which country, how you got there.
export function routeMapStops(library, stops) {
  return stops.map((stop, index) => {
    const place = placeOf(library, stop.placeId);
    const way = index ? hop(library, stops[index - 1], stop, stops) : { mode: "home" };
    return {
      id: stop.key,
      placeId: stop.placeId || "",
      name: placeName(library, stop),
      country: place?.country || stop.country || "",
      ll: place?.ll || null,
      mapXY: place?.mapXY || null,
      mapLabel: place?.mapLabel || null,
      mode: way.mode,
      path: way.path ? (way.reversed ? [...way.path].reverse() : way.path) : null,
      text: place?.summary || "参考路线没到过这里，每天先空着。",
      image: place?.image || "",
      nights: stop.nights,
    };
  });
}

// The stops for the route map, with how you got to each one.
export function mapStops(library, data) {
  const stops = data.plan?.stops || [];
  return stops.map((stop, index) => {
    const place = placeOf(library, stop.placeId);
    const days = data.days.filter((day) => day.stopKey === stop.key);
    const way = index ? hop(library, stops[index - 1], stop, stops) : { mode: "home" };
    return {
      id: stop.key,
      placeId: stop.placeId || "",
      name: placeName(library, stop),
      country: place?.country || stop.country || "",
      ll: place?.ll || null,
      mapXY: place?.mapXY || null,
      mapLabel: place?.mapLabel || null,
      mode: way.mode,
      // The road we drove into this stop, pointing the way the visitor goes.
      path: way.path ? (way.reversed ? [...way.path].reverse() : way.path) : null,
      text: place?.summary || "参考路线没到过这里，每天先空着。",
      image: place?.image || "",
      dayIds: days.map((day) => day.id),
      first: days[0]?.dayNumber,
      last: days.at(-1)?.dayNumber,
      nights: days.length,
    };
  });
}

// What the clock on the road is called on day `index`: the phone's own time for a place with no zone,
// the place's name on a day that changes time zone (a flight day starts in the old one), else local.
function clockName(library, data, index, phoneZone) {
  const where = placeOfDay(library, data, data.days[index], phoneZone);
  if (where.zoneFrom === "device") return "手机时间";
  const before = index > 0 ? placeOfDay(library, data, data.days[index - 1], phoneZone) : null;
  return before && before.tz !== where.tz && where.name ? `${where.name}时间` : "当地";
}

// Which day of the plan it is now, on the wall clock where that day happens. Between a day that has
// ended where it was and the next one that has not begun where it will be (flying west, the night
// before), it is still the day that just ended, after midnight.
export function todayOf(library, data, now = new Date(), phoneZone = deviceZone()) {
  let justOver = null;
  for (const [index, day] of data.days.entries()) {
    if (!day.date) return null;
    const { tz } = placeOfDay(library, data, day, phoneZone);
    const [date, time] = wallClock(now, tz).split(" ");
    const [hour, minute] = time.split(":").map(Number);
    if (date === day.date) return { day, index, tz, time, minutes: hour * 60 + minute, clock: clockName(library, data, index, phoneZone) };
    if (date === addDays(day.date, 1) && index < data.days.length - 1) {
      justOver = { day, index, tz, time, minutes: 1440 + hour * 60 + minute, clock: clockName(library, data, index, phoneZone) };
    }
  }
  return justOver;
}

// Day 1 at 10:00, for the preview before the trip.
export function previewDay(library, data, phoneZone = deviceZone()) {
  const day = data.days[0];
  if (!day?.date) return null;
  return { day, index: 0, tz: placeOfDay(library, data, day, phoneZone).tz, time: "10:00", minutes: 600, clock: clockName(library, data, 0, phoneZone) };
}

// The first step still ahead at `minutes`, and how many are behind. Meals, what to do if something
// falls through, and all but the first of a set of A/B options are not steps.
export function nextStep(day, minutes) {
  const steps = daySteps(day);
  const ticks = dayTicks(day);
  const index = ticks.findIndex((at) => at > minutes);
  const done = index < 0 ? steps.length : index;
  // A step without its own time counts as ahead while the one before it is.
  return { step: index < 0 ? null : steps[index].block, options: index < 0 ? 0 : steps[index].options, done, ticks };
}

export function firstStep(day) {
  const step = day ? daySteps(day)[0]?.block : null;
  if (!step) return null;
  return { what: String(step.activity || step.place).split(/[。；，]/)[0], when: step.period, minutes: stepMinutes(step.period) };
}

// Forecasts: for places with a day from yesterday to 15 days ahead, one request per place. A request
// names the place and asks for its next 16 days; it never carries the plan's dates (the site's host
// logs the addresses a page asks for), and the days are picked out here.
export const FORECAST_DAYS = 16;
export const FORECAST_KEEP = 6 * 60 * 60 * 1000;
export const FORECAST_RETRY = 10 * 60 * 1000;

export function forecastRequests(library, data, today) {
  const from = Date.parse(`${today}T00:00:00Z`);
  const wanted = new Map();
  for (const day of data.days) {
    if (!day.date) continue;
    const gap = (Date.parse(`${day.date}T00:00:00Z`) - from) / 86400000;
    if (gap < -1 || gap > FORECAST_DAYS - 1) continue;
    const { place } = placeOfDay(library, data, day);
    if (!place?.ll || !place.tz) continue;
    const entry = wanted.get(place.id) || { place, dates: [] };
    // The first and last days may fall outside what the place's own calendar gives today; the rest must be there.
    if (gap >= 0 && gap <= FORECAST_DAYS - 2 && !entry.dates.includes(day.date)) entry.dates.push(day.date);
    wanted.set(place.id, entry);
  }
  return [...wanted.values()].map(({ place, dates }) => {
    const [lon, lat] = place.ll;
    return {
      placeId: place.id,
      url: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(place.tz)}&past_days=1&forecast_days=${FORECAST_DAYS}`,
      dates: [...dates].sort(),
    };
  });
}

export function readForecast(placeId, body) {
  const out = {};
  const daily = body?.daily;
  if (!Array.isArray(daily?.time)) return out;
  daily.time.forEach((date, index) => {
    const high = daily.temperature_2m_max?.[index];
    const low = daily.temperature_2m_min?.[index];
    if (typeof date !== "string" || typeof high !== "number" || typeof low !== "number") return;
    const rain = daily.precipitation_probability_max?.[index];
    out[`${placeId}:${date}`] = { high: Math.round(high), low: Math.round(low), rain: typeof rain === "number" ? Math.round(rain) : null, word: weatherWord(daily.weather_code?.[index]) };
  });
  return out;
}

// The kept forecasts: { v: 2, places: { placeId: { at, days: { date: forecast } } }, failed: { placeId: at } }.
// Anything else (an older shape, a damaged value) is an empty store.
export function forecastStore(value) {
  const plain = (item) => Boolean(item) && typeof item === "object" && !Array.isArray(item);
  if (!plain(value) || value.v !== 2) return { v: 2, places: {}, failed: {} };
  const places = Object.fromEntries(Object.entries(plain(value.places) ? value.places : {})
    .filter(([, entry]) => plain(entry) && Number.isFinite(entry.at) && plain(entry.days)));
  const failed = Object.fromEntries(Object.entries(plain(value.failed) ? value.failed : {}).filter(([, at]) => Number.isFinite(at)));
  return { v: 2, places, failed };
}

// Forecasts to show: "placeId:date" for every place fetched in the last six hours.
export function keptForecasts(store, now) {
  const out = {};
  for (const [placeId, entry] of Object.entries(store.places)) {
    if (now - entry.at >= FORECAST_KEEP) continue;
    for (const [date, forecast] of Object.entries(entry.days)) out[`${placeId}:${date}`] = forecast;
  }
  return out;
}

// The requests still to make: a place whose kept forecast is old or lacks one of the plan's days there.
// A place tried in the last ten minutes (it failed, or it had nothing more) waits.
export function forecastsToFetch(requests, store, now) {
  return requests.filter((request) => {
    const entry = store.places[request.placeId];
    const fresh = entry && now - entry.at < FORECAST_KEEP;
    if (fresh && request.dates.every((date) => entry.days[date])) return false;
    const tried = Math.max(entry?.at || 0, store.failed[request.placeId] || 0);
    return now - tried >= FORECAST_RETRY;
  });
}

// The store after an answer for one place: its days, or a note that it failed. Old entries go; a failed
// refill leaves the place's forecast that is still fresh where it was.
export function keepForecast(store, placeId, body, now) {
  const days = Object.fromEntries(Object.entries(readForecast(placeId, body)).map(([key, forecast]) => [key.slice(placeId.length + 1), forecast]));
  const got = Object.keys(days).length > 0;
  const places = Object.fromEntries(Object.entries(store.places).filter(([id, entry]) => (id !== placeId || !got) && now - entry.at < FORECAST_KEEP));
  const failed = Object.fromEntries(Object.entries(store.failed).filter(([id, at]) => id !== placeId && now - at < FORECAST_RETRY));
  if (got) places[placeId] = { at: now, days };
  else failed[placeId] = now;
  return { v: 2, places, failed };
}

// Milliseconds until the first kept forecast is too old to show, or null when none is kept. The page looks
// again then (and when it is shown again after being in the background), so an old forecast never stays up.
export function forecastRecheckIn(store, now) {
  const left = Object.values(store.places).map((entry) => entry.at + FORECAST_KEEP - now).filter((ms) => ms > 0);
  return left.length ? Math.min(...left) : null;
}

// Milliseconds until the next day begins on this device's clock.
export function msToNextDay(now) {
  const at = new Date(now);
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1).getTime() - now;
}

// What the weather on the plan page does at `now`. The requests are worked out again for today each
// time (a page left open past midnight, or opened 17 days out and kept open, asks for the days that came
// into range); `toFetch` are the ones to send now; `wakeIn` is when to look again: the next day, a kept
// forecast running out, or the retry of a place that failed or came back without all its days.
export function forecastLook(library, data, store, now) {
  const requests = forecastRequests(library, data, localToday(new Date(now)));
  const toFetch = forecastsToFetch(requests, store, now);
  const waits = [msToNextDay(now)];
  const expiry = forecastRecheckIn(store, now);
  if (expiry !== null) waits.push(expiry);
  for (const request of requests) {
    if (toFetch.includes(request)) continue;
    const entry = store.places[request.placeId];
    if (entry && now - entry.at < FORECAST_KEEP && request.dates.every((date) => entry.days[date])) continue;
    const tried = Math.max(entry?.at || 0, store.failed[request.placeId] || 0);
    waits.push(Math.max(0, tried + FORECAST_RETRY - now));
  }
  return { requests, toFetch, wakeIn: Math.min(...waits) };
}
