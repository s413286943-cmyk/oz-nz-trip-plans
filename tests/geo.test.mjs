import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, presetStops } from "../src/lib/compose.js";
import { addDays } from "../src/lib/dates.js";
import { removeDay, renumberDays } from "../src/lib/edits.js";
import { dayTicks, daySteps } from "../src/lib/light.js";
import { mapCardStop, stopCard } from "../src/lib/mapCard.js";
import { rideRidge } from "../src/lib/ride.js";
import { planGeometry, textWidth } from "../src/lib/routeMap.js";
import {
  FORECAST_KEEP,
  FORECAST_RETRY,
  forecastRequests,
  forecastStore,
  forecastsToFetch,
  keepForecast,
  keptForecasts,
  mapStops,
  nextStep,
  placeOfDay,
  readForecast,
  todayOf,
  weatherWord,
} from "../src/lib/tripDays.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };
const id = (name) => library.places.find((item) => item.name.startsWith(name)).id;
// Example dates stay in March–June and September–November (see scripts/check-privacy.mjs).
const make = (stops, startDate = "2030-05-06") => composePlan(library, sources, { stops, startDate, adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" });
const answer = (dates, code = 61) => ({ daily: { time: dates, temperature_2m_max: dates.map(() => 20.4), temperature_2m_min: dates.map(() => 11.6), precipitation_probability_max: dates.map(() => 30), weather_code: dates.map(() => code) } });
const span = (from, count) => Array.from({ length: count }, (_, index) => addDays(from, index));

describe("forecasts", () => {
  const data = make(presetStops(library, "nz"), "2030-03-18");
  const today = "2030-03-10";

  it("asks by place and number of days only: no date of the plan leaves the page", () => {
    const requests = forecastRequests(library, data, today);
    assert.ok(requests.length >= 1);
    for (const request of requests) {
      assert.doesNotMatch(request.url, /\d{4}-\d{2}-\d{2}|start_date|end_date/);
      assert.match(request.url, /past_days=1&forecast_days=16$/);
    }
  });

  it("does not insist on the first and last day of the window, which the place's own calendar may not have yet", () => {
    // Day 1 is today + 8; with a window of today … today + 15, the 8th day of the plan is the last one asked for.
    const requests = forecastRequests(library, data, "2030-03-03");
    const dates = requests.flatMap((request) => request.dates);
    assert.ok(dates.every((date) => date >= "2030-03-03" && date <= addDays("2030-03-03", 14)), dates.join(","));
    assert.ok(!dates.includes(addDays("2030-03-03", 15)), "today + 15 is a bonus, not a reason to ask again");
  });

  it("keeps each place's whole answer, shows it, and asks again only for a place or a day it lacks", () => {
    const now = Date.UTC(2030, 2, 10, 1);
    const requests = forecastRequests(library, data, today);
    let store = forecastStore(null);
    assert.equal(forecastsToFetch(requests, store, now).length, requests.length, "nothing kept: ask for every place");
    for (const request of requests) store = keepForecast(store, request.placeId, answer(span("2030-03-09", 17)), now);
    assert.equal(forecastsToFetch(requests, store, now + 60000).length, 0, "everything kept");
    const shown = keptForecasts(store, now + 60000);
    assert.deepEqual(shown[`${requests[0].placeId}:2030-03-18`], { high: 20, low: 12, rain: 30, word: "小雨" });

    // The first day moved three days later: still inside the 16 days kept, so nothing to ask.
    const later = make(presetStops(library, "nz"), "2030-03-21");
    assert.equal(forecastsToFetch(forecastRequests(library, later, today), store, now + 60000).length, 0);

    // A place that was not in the plan before is asked for; one whose kept answer lacks a day is asked again after ten minutes.
    const melbourne = make([{ key: "m", placeId: id("墨尔本"), nights: 3 }], "2030-03-12");
    const fresh = forecastRequests(library, melbourne, today);
    assert.deepEqual(forecastsToFetch(fresh, store, now + 60000).map((request) => request.placeId), [id("墨尔本")]);
    const short = keepForecast(store, id("墨尔本"), answer(["2030-03-12"]), now);
    assert.equal(forecastsToFetch(fresh, short, now + 60000).length, 0, "just asked: wait");
    assert.equal(forecastsToFetch(fresh, short, now + FORECAST_RETRY).length, 1, "ten minutes on, ask again for the missing days");

    // Six hours on, everything is old.
    assert.deepEqual(keptForecasts(store, now + FORECAST_KEEP), {});
    assert.equal(forecastsToFetch(requests, store, now + FORECAST_KEEP).length, requests.length);
  });

  it("a failed place waits ten minutes instead of being asked on every key press", () => {
    const now = Date.UTC(2030, 2, 10, 1);
    const requests = forecastRequests(library, data, today);
    let store = forecastStore(null);
    for (const request of requests) store = keepForecast(store, request.placeId, null, now);
    assert.deepEqual(keptForecasts(store, now), {});
    assert.equal(forecastsToFetch(requests, store, now + 1000).length, 0);
    assert.equal(forecastsToFetch(requests, store, now + FORECAST_RETRY).length, requests.length);
    // An answer later clears the failure.
    store = keepForecast(store, requests[0].placeId, answer(span("2030-03-09", 17)), now + FORECAST_RETRY);
    assert.ok(!(requests[0].placeId in store.failed));
  });

  it("an older or damaged store counts as empty", () => {
    assert.deepEqual(forecastStore({ at: Date.now(), forecasts: { "x:2030-03-18": {} } }), { v: 2, places: {}, failed: {} });
    assert.deepEqual(forecastStore("nonsense"), { v: 2, places: {}, failed: {} });
    assert.deepEqual(forecastStore({ v: 2, places: { a: { at: "soon", days: {} }, b: { at: 1, days: {} } }, failed: { c: 2, d: "x" } }), { v: 2, places: { b: { at: 1, days: {} } }, failed: { c: 2 } });
    assert.deepEqual(readForecast("x", { daily: { time: "2030-03-18" } }), {});
  });

  it("has a word for every weather code, snow showers and freezing rain included", () => {
    for (const code of [56, 57, 66, 67, 77, 85, 86]) assert.ok(weatherWord(code), `code ${code}`);
    assert.equal(weatherWord(85), "阵雪");
  });
});

describe("time zones on the road", () => {
  it("a place outside the place library keeps the Australian state chosen for it; one elsewhere follows the phone", () => {
    const own = make([
      { key: "a", placeId: "", name: "Bali", country: "other", nights: 2 },
      { key: "b", placeId: "", name: "Perth", country: "au", tz: "Australia/Perth", nights: 2 },
    ], "2030-04-08");
    assert.equal(own.plan.stops[1].tz, "Australia/Perth", "the zone stays with the plan");
    // Bali day 1 at 20:00 on a phone set to Bali time.
    const evening = todayOf(library, own, new Date("2030-04-08T12:00:00Z"), "Asia/Makassar");
    assert.deepEqual([evening.index, evening.time, evening.clock], [0, "20:00", "手机时间"]);
    // Perth day 3 at 23:30 Perth time is still day 3, not day 4.
    const late = todayOf(library, own, new Date("2030-04-10T15:30:00Z"), "Asia/Makassar");
    assert.deepEqual([late.index, late.time, late.clock], [2, "23:30", "Perth时间"]);
  });

  it("an Australian place added before the state was asked keeps Sydney time; a zone from a file is checked", () => {
    const data = make([{ key: "a", placeId: "", name: "Perth", country: "au", nights: 2 }], "2030-04-08");
    assert.equal(placeOfDay(library, data, data.days[0]).tz, "Australia/Sydney");
    const odd = { ...data, plan: { ...data.plan, stops: [{ ...data.plan.stops[0], tz: "Mars/Base" }] } };
    assert.equal(placeOfDay(library, odd, odd.days[0]).tz, "Australia/Sydney");
  });

  it("flying west, the night between the two days stays on the day that just ended", () => {
    const data = make([{ key: "a", placeId: id("基督城"), nights: 1 }, { key: "b", placeId: id("皇后镇"), nights: 2 }, { key: "c", placeId: id("悉尼"), nights: 1 }]);
    // Day 3 (2030-05-08) is in New Zealand, day 4 in Sydney, two hours behind.
    assert.equal(todayOf(library, data, new Date("2030-05-08T11:59:00Z")).time, "23:59");
    const night = todayOf(library, data, new Date("2030-05-08T12:30:00Z"));
    assert.deepEqual([night.index, night.time, night.minutes], [2, "00:30", 1470]);
    assert.ok(nextStep(night.day, night.minutes).step === null, "the day's steps are all behind");
    const next = todayOf(library, data, new Date("2030-05-08T14:00:00Z"));
    assert.deepEqual([next.index, next.time, next.clock], [3, "00:00", "悉尼时间"]);
    // After the last day, nothing.
    assert.equal(todayOf(library, data, new Date("2030-05-11T15:00:00Z")), null);
  });

  it("the day you fly east says whose clock it shows", () => {
    const data = make(presetStops(library, "nz"), "2030-03-18");
    const today = todayOf(library, data, new Date("2030-03-20T20:30:00Z"));
    assert.equal(today.day.from, "nz:d4");
    assert.equal(today.clock, "基督城时间");
    assert.equal(todayOf(library, data, new Date("2030-03-21T20:30:00Z")).clock, "当地");
  });
});

describe("what comes next on the road", () => {
  const day = (dayId) => sources.nz.days.find((item) => item.id === dayId);

  it("leaves out the plans for rain or a cancelled tour", () => {
    const milford = day("d11");
    const { step } = nextStep(milford, 600);
    assert.ok(!step || !/备选/.test(step.choice || ""), "not the rainy-day fallback");
    assert.ok(daySteps(milford).every(({ block }) => !/取消/.test(block.period)));
    const glacier = day("d6");
    assert.ok(daySteps(glacier).every(({ block }) => !/下雨|关闭/.test(block.period)));
    assert.equal(dayTicks(glacier).length, daySteps(glacier).length);
  });

  it("counts a set of A/B options once", () => {
    const wanaka = day("d9");
    const set = daySteps(wanaka).find(({ block }) => /^上午 A/.test(block.choice || ""));
    assert.equal(set.options, 4);
    assert.equal(daySteps(wanaka).filter(({ block }) => /^上午 [B-D]/.test(block.choice || "")).length, 0);
    const morning = nextStep(wanaka, 0);
    assert.ok(morning.options >= 1);
  });
});

describe("clearing the first day", () => {
  it("takes every date off the visitor's plan", () => {
    const data = make(presetStops(library, "nz"), "2030-03-18");
    const cleared = renumberDays({ ...data, plan: { ...data.plan, startDate: "" } });
    assert.ok(cleared.days.every((day) => !("date" in day) && !("weekday" in day)));
    assert.equal(todayOf(library, cleared, new Date("2030-03-20T20:30:00Z")), null);
    assert.equal(forecastRequests(library, cleared, "2030-03-10").length, 0);
  });

  it("leaves the dates of a trip without a plan (the 2026 route) alone", () => {
    const trip = sources.au2026;
    const edited = removeDay(trip, trip.days.at(-1).id);
    assert.ok(edited.days.every((day) => day.date));
  });
});

describe("the map card", () => {
  it("a stop whose only day was deleted leaves the map with the rest of the plan", () => {
    const data = make(presetStops(library, "nz"), "2030-03-18");
    const christchurch = data.days.find((item) => item.from === "nz:d4");
    const edited = removeDay(data, christchurch.id);
    const geometry = planGeometry(mapStops(library, edited), "nz");
    assert.equal(geometry.stops.find((stop) => stop.name === "基督城"), undefined);
    assert.ok(geometry.stops.every((stop) => !/undefined/.test(stopCard(mapCardStop(geometry, stop.id)).name)));
  });

  it("an older plan whose days do not name their stop keeps it on the map, and says its days are gone", () => {
    const data = make(presetStops(library, "nz"), "2030-03-18");
    const older = { ...data, days: data.days.map(({ stopKey: _key, ...day }) => day) };
    const geometry = planGeometry(mapStops(library, removeDay(older, older.days[1].id)), "nz");
    const pin = geometry.stops.find((stop) => stop.name === "基督城");
    const card = stopCard(mapCardStop(geometry, pin.id));
    assert.equal(card.when, "这一站的日子都删掉了");
    assert.ok(!/undefined/.test(card.name + card.when));
  });

  it("the corner circle names each place of the other country instead of calling them one place twice", () => {
    const data = make([{ key: "a", placeId: id("悉尼"), nights: 2 }, { key: "b", placeId: id("基督城"), nights: 1 }, { key: "c", placeId: id("皇后镇"), nights: 2 }, { key: "d", placeId: id("悉尼"), nights: 2 }]);
    const geometry = planGeometry(mapStops(library, data), "au");
    const corner = geometry.stops.find((stop) => stop.away);
    assert.equal(corner.name, "基督城、皇后镇（新西兰）");
    assert.ok(!stopCard(corner).name.includes("来"), stopCard(corner).name);
    const sydney = geometry.stops.find((stop) => stop.name === "悉尼");
    assert.equal(stopCard(sydney).name, "悉尼（来 2 次）", "the same place twice is still one pin, visited twice");
  });
});

describe("drawing the maps", () => {
  const label = (stop, size = 16) => {
    const [dx, , anchor] = stop.label;
    const width = textWidth(stop.name, size);
    const left = stop.xy[0] + dx - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0);
    return [left, left + width];
  };

  it("the Great Ocean Road sits clear of the card under the map, and each dot taps its own stop", () => {
    const data = make(presetStops(library, "au2026"), "2030-06-17");
    const geometry = planGeometry(mapStops(library, data), "au");
    for (const stop of geometry.stops) assert.ok(stop.xy[1] + stop.label[1] <= 440, `${stop.name} label at ${stop.xy[1] + stop.label[1]}`);
    for (const stop of geometry.stops) {
      for (const other of geometry.stops) {
        if (other === stop) continue;
        assert.ok(Math.hypot(other.xy[0] - stop.xy[0], other.xy[1] - stop.xy[1]) > other.hit, `${other.name}'s tap circle covers ${stop.name}'s dot`);
      }
    }
  });

  it("names in the corner circle stay on the sheet", () => {
    const geometry = planGeometry(mapStops(library, make(presetStops(library, "nz"), "2030-03-18")), "au");
    const corner = geometry.stops.find((stop) => stop.away);
    const [left, right] = label(corner);
    assert.ok(left >= 4 && right <= 386, `${left}–${right}`);
  });

  it("a stretch the reference routes never covered is a thin straight line, not a flight", () => {
    const data = make([{ key: "a", placeId: id("基督城"), nights: 1 }, { key: "b", placeId: id("Wānaka"), nights: 2 }]);
    const geometry = planGeometry(mapStops(library, data), "nz");
    assert.equal(geometry.flights, "");
    assert.match(geometry.unknown, /^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
  });

  it("the two longest drives' words do not overlap when the days are close", () => {
    const days = Array.from({ length: 14 }, (_, index) => ({ driveHours: index === 4 ? 4.5 : index === 6 ? 4.4 : 1, transport: index === 4 ? "自驾约 4–4.5 小时" : index === 6 ? "自驾约 3.5–4.5 小时" : "" }));
    const ridge = rideRidge(days);
    const [a, b] = ridge.peaks;
    const width = (peak) => Math.max(textWidth(peak.day, 13), textWidth(peak.hours, 13));
    assert.ok(b.labelX - a.labelX >= (width(a) + width(b)) / 2, `${a.labelX} / ${b.labelX}`);
    for (const peak of ridge.peaks) assert.ok(peak.labelX - width(peak) / 2 >= 0 && peak.labelX + width(peak) / 2 <= ridge.width);
    // Far apart, they stay over their peaks.
    const apart = rideRidge(days.map((day, index) => ({ ...day, driveHours: index === 3 ? 4.5 : index === 10 ? 4.4 : 1 })));
    assert.deepEqual(apart.peaks.map((peak) => peak.labelX), apart.peaks.map((peak) => peak.x));
  });
});
