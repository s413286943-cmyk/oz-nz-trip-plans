import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, presetStops } from "../src/lib/compose.js";
import { dayTicks, stepMinutes, sunWords } from "../src/lib/light.js";
import { overviewGeometry, planGeometry, sheetsFor } from "../src/lib/routeMap.js";
import { sunTimes } from "../src/lib/sun.js";
import { FORECAST_KEEP, FORECAST_RETRY, dayWeather, forecastLook, forecastRequests, forecastStore, keepForecast, lightRows, mapStops, msToNextDay, nextStep, readForecast, todayOf } from "../src/lib/tripDays.js";
import { rideRidge } from "../src/lib/ride.js";
import { mapCardStop } from "../src/lib/mapCard.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const overview = read("data/nz-overview.json");
const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };
// Example dates stay in March–June and September–November (see scripts/check-privacy.mjs).
const plan = (startDate = "2030-03-18") => composePlan(library, sources, { stops: presetStops(library, "nz"), startDate, adults: 2, children: 0, rooms: 1, cars: 1 });
const place = (name) => library.places.find((item) => item.name.startsWith(name));

describe("sun", () => {
  it("works out sunrise and sunset in the place's own time zone", () => {
    const sydney = sunTimes({ ll: place("悉尼").ll, tz: place("悉尼").tz, date: "2030-03-18" });
    assert.ok(sydney.rise > 6 * 60 + 50 && sydney.rise < 7 * 60 + 5, sydney.riseTime);
    assert.ok(sydney.set > 19 * 60 + 2 && sydney.set < 19 * 60 + 16, sydney.setTime);
    const twizel = sunTimes({ ll: place("Twizel").ll, tz: place("Twizel").tz, date: "2030-03-22" });
    assert.ok(twizel.set > 19 * 60 + 40 && twizel.set < 19 * 60 + 56, twizel.setTime);
    const winter = sunTimes({ ll: place("墨尔本").ll, tz: place("墨尔本").tz, date: "2030-06-17" });
    assert.ok(winter.set < 18 * 60, `Melbourne in winter sets early: ${winter.setTime}`);
    assert.equal(sunTimes({ ll: null, tz: "Pacific/Auckland", date: "2030-03-18" }), null);
  });

  it("reads clock times and time-of-day words into the ruler", () => {
    assert.equal(stepMinutes("16:00 前后"), 960);
    assert.equal(stepMinutes("约 15:00–15:45"), 900);
    assert.equal(stepMinutes("傍晚"), 1080);
    assert.equal(stepMinutes("全天"), null);
    const day = sources.nz.days.find((item) => item.id === "d5");
    const ticks = dayTicks(day);
    assert.ok(ticks.every((at, index) => index === 0 || at >= ticks[index - 1] - 60));
    assert.equal(sunWords(600, { rise: 400, set: 1200 }), "离日落 10 小时 0 分");
  });
});

describe("route maps", () => {
  it("our route: every stop, the road, the side trips and the flights", () => {
    const geometry = overviewGeometry(overview);
    assert.equal(geometry.stops.length, 7);
    assert.ok(geometry.road.startsWith("M") && geometry.spurs.length > 0 && geometry.flights.length > 0);
    assert.deepEqual(geometry.stops.find((stop) => stop.name === "悉尼").xy, [62, 120]);
  });

  it("a visitor's route follows the roads we drove, with the place we fly in from in the corner", () => {
    const stops = mapStops(library, plan());
    assert.deepEqual(sheetsFor(stops), ["au", "nz"], "Sydney first, then New Zealand");
    const nz = planGeometry(stops, "nz");
    assert.equal(nz.stops.length, 7);
    assert.ok(nz.stops.find((stop) => stop.name === "悉尼（澳洲）").away, "Sydney sits in the corner of the New Zealand sheet");
    assert.ok(nz.road.split("M").length > 4, "one road per drive");
    assert.ok(nz.road.includes("C"), "drawn along the road, not straight");
    const au = planGeometry(stops, "au");
    assert.deepEqual(au.stops.map((stop) => stop.name), ["悉尼", "基督城（新西兰）"]);
    assert.equal(au.drawn, 1);
  });

  it("an Australian route gets the Australian sheet, Great Ocean Road and all", () => {
    const data = composePlan(library, sources, { stops: presetStops(library, "au2026"), startDate: "2030-06-17", adults: 4, children: 0, rooms: 2, cars: 1 });
    const stops = mapStops(library, data);
    assert.deepEqual(sheetsFor(stops), ["au"]);
    const au = planGeometry(stops, "au");
    assert.equal(au.drawn, 5, "Melbourne (twice, one pin), Apollo Bay, Port Campbell, Cairns, Sydney");
    assert.equal(au.stops.find((stop) => stop.name === "墨尔本").visits.length, 2);
    assert.ok(au.road.includes("C") && au.flights.split("M").length === 3, "the coast road, and two flights");
    assert.equal(au.left.length, 0);
  });
});

describe("every day's light and weather", () => {
  it("each day gets its place's sunset and that month's usual weather", () => {
    const rows = lightRows(library, plan());
    assert.equal(rows.length, 17);
    assert.equal(rows[0].town, "悉尼");
    assert.equal(rows[0].sun.setTime, sunTimes({ ll: place("悉尼").ll, tz: place("悉尼").tz, date: "2030-03-18" }).setTime);
    assert.equal(rows[0].weather.kind, "normal");
    assert.equal(rows[0].weather.high, place("悉尼").climate[2].high, "March is the third month");
    assert.ok(rows.filter((row) => row.endsStop).length >= 6);
    assert.equal(rows.at(-1).town, "回程");
  });

  it("asks for forecasts only for days in the next 16, one request per place", () => {
    const data = plan("2030-03-18");
    assert.equal(forecastRequests(library, data, "2029-11-20").length, 0);
    const near = forecastRequests(library, data, "2030-03-10");
    assert.ok(near.length >= 1);
    assert.equal(new Set(near.map((request) => request.placeId)).size, near.length);
    assert.match(near[0].url, /forecast_days=16/);
    assert.ok(near[0].dates.includes("2030-03-18"), "the plan's days are picked out of the answer, not asked for");
    const forecasts = readForecast(near[0].placeId, { daily: { time: ["2030-03-18"], temperature_2m_max: [27.4], temperature_2m_min: [18.6], precipitation_probability_max: [40], weather_code: [61] } });
    const weather = dayWeather(library, data, data.days[0], forecasts);
    assert.deepEqual(weather, { kind: "forecast", high: 27, low: 19, rain: 40, word: "小雨" });
  });
});

describe("a plan page left open", () => {
  // Local noon on this device, so "today" is the date written whatever its time zone.
  const at = (date, hours = 12) => new Date(`${date}T${String(hours).padStart(2, "0")}:00:00`).getTime();
  const empty = forecastStore(null);

  it("asks for the days that came into range after midnight, and wakes up at midnight to do so", () => {
    const data = plan("2030-03-18");
    // Opened 16 days out: nothing to ask yet, but the page looks again when the next day begins.
    const before = forecastLook(library, data, empty, at("2030-03-02", 22));
    assert.equal(before.requests.length, 0);
    assert.ok(before.wakeIn <= 2 * 60 * 60 * 1000 && before.wakeIn > 0, `${before.wakeIn}`);
    assert.equal(before.wakeIn, msToNextDay(at("2030-03-02", 22)));
    // The look after midnight works the requests out for the new day.
    const after = forecastLook(library, data, empty, at("2030-03-03", 0) + 1000);
    assert.ok(after.requests.length >= 1);
    assert.deepEqual(after.toFetch, after.requests);
  });

  it("tries a failed place again after ten minutes, even with nothing kept", () => {
    const data = plan("2030-03-18");
    const now = at("2030-03-10");
    const first = forecastLook(library, data, empty, now);
    let store = empty;
    for (const request of first.toFetch) store = keepForecast(store, request.placeId, null, now);
    const later = forecastLook(library, data, store, now + 60 * 1000);
    assert.equal(later.toFetch.length, 0, "not asked again at once");
    assert.equal(later.wakeIn, FORECAST_RETRY - 60 * 1000, "but looked at again when the retry is due");
    assert.equal(forecastLook(library, data, store, now + FORECAST_RETRY).toFetch.length, first.toFetch.length);
  });

  it("wakes up when a kept forecast runs out", () => {
    const data = plan("2030-03-18");
    const now = at("2030-03-17", 9);
    const [request] = forecastLook(library, data, empty, now).requests;
    const days = Object.fromEntries(request.dates.map((date) => [date, { high: 20, low: 10, rain: 0, word: "晴" }]));
    const store = { v: 2, places: { [request.placeId]: { at: now, days } }, failed: {} };
    const look = forecastLook(library, { ...data, days: data.days.filter((day) => request.dates.includes(day.date)) }, store, now + 1000);
    assert.equal(look.toFetch.length, 0);
    assert.equal(look.wakeIn, Math.min(FORECAST_KEEP - 1000, msToNextDay(now + 1000)));
  });
});

describe("on the road", () => {
  it("knows which day it is on the local clock, and what comes next", () => {
    const data = plan("2030-03-18");
    // Day 4, 09:30 in Christchurch (UTC+13) is 20:30 UTC the evening before.
    const today = todayOf(library, data, new Date("2030-03-20T20:30:00Z"));
    assert.equal(today.day.from, "nz:d4");
    assert.equal(today.time, "09:30");
    const { step, done } = nextStep(today.day, today.minutes);
    assert.ok(step);
    assert.ok(done >= 0);
    assert.equal(todayOf(library, data, new Date("2031-10-01T00:00:00Z")), null);
  });

  it("draws the drive ridge with the two longest days named", () => {
    const ridge = rideRidge(plan().days);
    assert.deepEqual(ridge.peaks.map((peak) => peak.day), ["第 5 天", "第 10 天"]);
  });
});

describe("a plan whose places are all outside the place library", () => {
  it("has nothing to draw, and the map card is left out instead of failing", () => {
    const lib = read("data/places.json");
    const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };
    const own = [{ key: "s1", placeId: "", name: "Rotorua", country: "nz", nights: 2 }, { key: "s2", placeId: "", name: "Taupo", country: "nz", nights: 1 }];
    const data = composePlan(lib, sources, { stops: own, startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" });
    // Our own plan, and a New Zealand route file opened on the plan page: no route stops to place.
    for (const trip of [data, sources.nz]) assert.deepEqual(sheetsFor(mapStops(lib, trip)), []);
    assert.equal(mapCardStop(null, ""), null);
    const mixed = composePlan(lib, sources, { stops: [...presetStops(lib, "nz").slice(1, 3), ...own], startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" });
    const geometry = planGeometry(mapStops(lib, mixed), "nz");
    assert.equal(mapCardStop(geometry, "no-such-stop"), geometry.stops[0]);
    assert.equal(mapCardStop(geometry, geometry.stops.at(-1).id), geometry.stops.at(-1));
  });
});
