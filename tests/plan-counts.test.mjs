// The visitor's plan says the same thing everywhere: days and nights, where the car is picked up and
// returned, the budget lines typed in, and how fresh the weather shown is.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, estimateOwnBudget, planSize, presetStops } from "../src/lib/compose.js";
import { addDay } from "../src/lib/edits.js";
import { FORECAST_KEEP, forecastRecheckIn, keepForecast, keptForecasts } from "../src/lib/tripDays.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };
const id = (name) => library.places.find((place) => place.name.startsWith(name)).id;
const settings = (stops, patch = {}) => ({ stops, startDate: "2030-03-04", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours", ...patch });
const stop = (key, name, nights) => ({ key, placeId: id(name), nights });
const words = (value) => JSON.stringify(value);

describe("days and nights", () => {
  it("/plan counts the days the plan will have", () => {
    for (const preset of ["nz", "au2026"]) {
      const route = settings(presetStops(library, preset));
      const made = composePlan(library, sources, route);
      assert.deepEqual(planSize(library, sources, route), {
        days: made.days.length,
        nights: made.plan.stops.reduce((sum, item) => sum + item.nights, 0),
        stops: made.plan.stops.length,
      });
    }
    assert.equal(planSize(library, sources, settings(presetStops(library, "nz"))).days, 17);
  });

  it("a night added on the plan page shows in the route line, the stage, the stay and the stops", () => {
    let plan = composePlan(library, sources, settings([stop("s1", "悉尼", 1), stop("s2", "墨尔本", 2)]));
    plan = addDay(plan, plan.days[0].id);
    assert.match(plan.trip.route, /^悉尼 2 晚 → 墨尔本 2 晚$/);
    assert.equal(plan.stages[0].title, "悉尼 · 2 晚");
    assert.equal(plan.lodgings[0].status, "2 晚");
    assert.equal(plan.plan.stops[0].nights, 2);
  });

  it("a one-night stay does not repeat the reference route's 'several nights in a row'", () => {
    const plan = composePlan(library, sources, settings([stop("s1", "基督城", 1), stop("s2", "Twizel", 1)]));
    const twizel = plan.days.filter((day) => day.stopKey === "s2");
    const plain = words(twizel).replaceAll("参考路线连住", "");
    assert.doesNotMatch(plain, /连住[^"]{0,3}晚/);
    assert.match(words(twizel), /参考路线连住/);
  });
});

describe("picking up and returning the car", () => {
  it("a plan that ends the drive at Twizel is not told to return the car in Queenstown", () => {
    const plan = composePlan(library, sources, settings([stop("s1", "基督城", 2), stop("s2", "Twizel", 3)]));
    const notes = plan.days.flatMap((day) => (day.notes || []).map((note) => ({ ...note, day: day.id })));
    assert.equal(notes.filter((note) => note.label === "取车").length, 1);
    assert.equal(notes.filter((note) => note.label === "还车").length, 1);
    assert.ok(!notes.some((note) => /皇后镇|Frankton|Grant Road/.test(note.text) && /还/.test(note.text)), "no note sends the car back to Queenstown");
  });
});

describe("budget lines typed in", () => {
  it("stay in the list and the total when the estimate for them is gone", () => {
    const plan = composePlan(library, sources, settings([stop("s1", "悉尼", 3)], { startDate: "" }));
    const budget = estimateOwnBudget(library, plan, { adults: 2, rooms: 1, cars: 1 }, { car: { NZD: 123 }, insurance: { NZD: 456 } });
    assert.equal(budget.counts.carDays, 0);
    const car = budget.lines.find((line) => line.kind === "car");
    assert.ok(car && car.edited);
    assert.deepEqual(car.amounts, { NZD: 123 });
    assert.equal(budget.totals.NZD, 579);
  });
});

describe("kept forecasts", () => {
  const now = Date.UTC(2030, 2, 4);
  const day = { high: 20, low: 10, rain: 5, word: "晴" };

  it("a failed refill keeps the forecast that is still fresh", () => {
    const store = keepForecast({ v: 2, places: { p1: { at: now - 3600e3, days: { "2030-03-04": day } } }, failed: {} }, "p1", null, now);
    assert.deepEqual(keptForecasts(store, now), { "p1:2030-03-04": day });
    assert.equal(store.failed.p1, now);
  });

  it("says when the next kept forecast runs out, so the page can take it down", () => {
    const store = { v: 2, places: { p1: { at: now - 3600e3, days: { "2030-03-04": day } }, p2: { at: now - 7200e3, days: { "2030-03-05": day } } }, failed: {} };
    assert.equal(forecastRecheckIn(store, now), FORECAST_KEEP - 7200e3);
    assert.equal(forecastRecheckIn({ v: 2, places: {}, failed: {} }, now), null);
    assert.deepEqual(keptForecasts(store, now + FORECAST_KEEP), {});
  });
});
