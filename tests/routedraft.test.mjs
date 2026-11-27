import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, presetStops } from "../src/lib/compose.js";
import { renumberDays } from "../src/lib/edits.js";
import { savedFiles } from "../src/lib/recover.js";
import { DRAFT_KEY, carryOver, draftStore, readDraftFile, snapshot, startRoute } from "../src/lib/routeDraft.js";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };
const EMPTY = { stops: [], startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" };
const route = { ...EMPTY, stops: presetStops(library, "nz"), startDate: "2030-03-01" };
const made = composePlan(library, sources, route);
const draftAfterBuild = { ...route, basis: snapshot(route) };

describe("going back from the plan to change the route", () => {
  it("shows the first day and party set on the plan pages, not the old form", () => {
    const plan = { ...made.plan, startDate: "2030-04-10", adults: 3, rooms: 2 };
    const start = startRoute(draftAfterBuild, plan, EMPTY);
    assert.equal(start.startDate, "2030-04-10");
    assert.equal(start.adults, 3);
    assert.equal(start.rooms, 2);
    assert.deepEqual(start.stops.map((stop) => stop.placeId), route.stops.map((stop) => stop.placeId));
  });

  it("keeps what was changed on /plan since, and follows the plan for the rest", () => {
    const draft = { ...draftAfterBuild, stops: draftAfterBuild.stops.slice(1), adults: 4 };
    const plan = { ...made.plan, startDate: "2030-04-10" };
    const start = startRoute(draft, plan, EMPTY);
    assert.equal(start.stops.length, route.stops.length - 1);
    assert.equal(start.adults, 4);
    assert.equal(start.startDate, "2030-04-10");
    // A cleared route stays cleared.
    assert.deepEqual(startRoute({ ...draftAfterBuild, stops: [] }, made.plan, EMPTY).stops, []);
  });

  it("opens a plan from a file (another device) instead of this device's old form", () => {
    const other = composePlan(library, sources, { ...EMPTY, stops: presetStops(library, "au2026"), adults: 4, rooms: 2 });
    const start = startRoute(draftAfterBuild, other.plan, EMPTY);
    assert.deepEqual(start.stops.map((stop) => stop.placeId), other.plan.stops.map((stop) => stop.placeId));
    assert.equal(start.adults, 4);
  });

  it("reads a form saved before this was tracked, and a damaged one", () => {
    const old = startRoute({ ...route, startDate: "2030-03-01" }, { ...made.plan, startDate: "2030-04-10" }, EMPTY);
    assert.equal(old.startDate, "2030-04-10");
    assert.equal(old.stops.length, route.stops.length);
    assert.equal(startRoute({ stops: [] }, made.plan, EMPTY).stops.length, route.stops.length, "an empty old form falls back to the plan");
    const damaged = startRoute({ stops: [null, { placeId: route.stops[0].placeId, nights: "x" }], adults: "lots" }, null, EMPTY);
    assert.deepEqual(damaged.stops.map((stop) => stop.nights), [1]);
    assert.equal(damaged.adults, 2);
    assert.deepEqual(startRoute(null, null, EMPTY).stops, []);
  });
});

describe("making the plan again", () => {
  it("brings the checklist changes and the typed-in budget into the new plan", () => {
    const edited = renumberDays({
      ...made,
      prep: { added: [{ id: "m1", title: "换外币现金", detail: "" }], hidden: ["plan:x"] },
      plan: { ...made.plan, budget: { food: { CNY: 9000 } } },
    });
    const again = carryOver(edited, composePlan(library, sources, { ...route, stops: route.stops.slice(0, 4) }));
    assert.deepEqual(again.prep, edited.prep);
    assert.deepEqual(again.plan.budget, { food: { CNY: 9000 } });
    assert.equal(again.plan.stops.length, 4);
    assert.equal(carryOver(null, made), made);
    assert.equal("prep" in carryOver(made, made), false);
  });
});

describe("a route kept as a file opens again on /plan", () => {
  const known = (placeId) => library.places.some((place) => place.id === placeId);
  const form = { ...EMPTY, stops: presetStops(library, "nz").slice(0, 3), startDate: "2030-04-05", adults: 3, children: 1, rooms: 2, cars: 2, pace: "easy" };

  it("the file the error page saves brings back the stops, nights, first day and party", () => {
    const storage = memoryStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify({ ...form, basis: snapshot(form) }));
    const file = savedFiles(storage, "/plan").find((item) => item.kind === "draft");
    const opened = readDraftFile(file.text, EMPTY, known);
    assert.deepEqual(opened.stops.map((stop) => [stop.placeId, stop.nights]), form.stops.map((stop) => [stop.placeId, stop.nights]));
    assert.deepEqual([opened.startDate, opened.adults, opened.children, opened.rooms, opened.cars, opened.pace], ["2030-04-05", 3, 1, 2, 2, "easy"]);
    assert.equal("basis" in opened, false);
  });

  it("checks what it reads: places, nights, dates, party; and sends other files where they open", () => {
    const damaged = JSON.stringify({ format: "trip-share-route", route: {
      stops: [{ key: "a", placeId: "nowhere", nights: 2 }, { key: "a", placeId: form.stops[0].placeId, nights: 0 }, { key: "b", placeId: "", name: " Dunedin ", country: "nz", nights: 400 }, { key: "c", placeId: "", name: "  " }],
      startDate: "next week", adults: 0, children: -1, pace: "fast",
    } });
    const opened = readDraftFile(damaged, EMPTY, known);
    assert.deepEqual(opened.stops.map((stop) => [stop.placeId || stop.name, stop.nights]), [[form.stops[0].placeId, 1], ["Dunedin", 30]]);
    assert.equal(new Set(opened.stops.map((stop) => stop.key)).size, 2);
    assert.deepEqual([opened.startDate, opened.adults, opened.children, opened.pace], ["", 2, 0, "ours"]);
    assert.throws(() => readDraftFile("{nope", EMPTY, known), /不是这个网站/);
    assert.throws(() => readDraftFile(JSON.stringify({ format: "trip-share-route", route: { stops: [] } }), EMPTY, known), /没有找到排好的路线/);
    assert.throws(() => readDraftFile(JSON.stringify({ format: "trip-share", v: 2, trip: "mine", data: made }), EMPTY, known), (error) => error.page?.href === "/mine");
    assert.throws(() => readDraftFile(JSON.stringify({ format: "trip-share", v: 2, trip: "nz", data: {} }), EMPTY, known), (error) => error.page?.href === "/nz");
  });
});

describe("two tabs of /plan change the route", () => {
  it("a tab does not write its older form over the one another tab saved, and gets that one back", () => {
    const storage = memoryStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify({ ...EMPTY, stops: [{ key: "a", placeId: "p1", nights: 2 }] }));
    const one = draftStore(storage);
    const two = draftStore(storage);
    const a = one.load();
    const b = two.load();
    assert.equal(one.save({ ...a, stops: [...a.stops, { key: "b", placeId: "p2", nights: 2 }] }).saved, true);
    assert.equal(two.current(), false, "the second tab can tell its form is old");
    const late = two.save({ ...b, stops: [...b.stops, { key: "c", placeId: "p3", nights: 2 }] });
    assert.equal(late.saved, false);
    assert.deepEqual(late.draft.stops.map((stop) => stop.key), ["a", "b"]);
    assert.deepEqual(JSON.parse(storage.getItem(DRAFT_KEY)).stops.map((stop) => stop.key), ["a", "b"]);
    // Working on the form it got back, its next change is saved with the first tab's.
    assert.equal(two.save({ ...late.draft, stops: [...late.draft.stops, { key: "c", placeId: "p3", nights: 2 }] }).saved, true);
    assert.deepEqual(JSON.parse(storage.getItem(DRAFT_KEY)).stops.map((stop) => stop.key), ["a", "b", "c"]);
    assert.equal(one.current(), false);
  });
});
