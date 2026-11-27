import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, presetStops } from "../src/lib/compose.js";
import { tripToMarkdown } from "../src/lib/markdown.js";
import { ImportError, exportFile, loadCopy, normalizeTrip, readCopy, readImport, routeOf, saveCopy, storageKey } from "../src/lib/edits.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const nz = read("data/nz.json");
const au2026 = read("data/au2026.json");
const library = read("data/places.json");
const plan = composePlan(library, { nz, au2026 }, { stops: presetStops(library, "nz"), startDate: "2030-03-04", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" });
const ownOnly = composePlan(library, { nz, au2026 }, { stops: [{ key: "s1", placeId: "", name: "Rotorua", country: "nz", nights: 2 }], startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" });

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe("what is stored or opened is checked before a page uses it", () => {
  it("leaves our routes and a laid-out plan exactly as they are", () => {
    for (const data of [nz, au2026, plan, ownOnly]) assert.deepEqual(normalizeTrip(data), data);
  });

  it("tells the three routes apart", () => {
    assert.equal(routeOf(nz), "nz");
    assert.equal(routeOf(au2026), "au2026");
    assert.equal(routeOf(plan), "mine");
    assert.equal(routeOf(ownOnly), "mine");
  });

  it("repairs field types that would break a page and drops what cannot be used", () => {
    const broken = structuredClone(nz);
    delete broken.stages;
    broken.days[0].blocks.push(null, "text");
    broken.days[0].notes = "带伞";
    broken.days[1].title = { nested: true };
    broken.days[1].date = "not a date";
    broken.days[2].drive = "no";
    broken.days.push({ ...broken.days[3] }, null, { blocks: [] });
    const fixed = normalizeTrip(broken);
    assert.deepEqual(fixed.stages, []);
    assert.ok(fixed.days[0].blocks.every((block) => block && typeof block === "object"));
    assert.deepEqual(fixed.days[0].notes, []);
    assert.equal(fixed.days[1].title, "");
    assert.equal("date" in fixed.days[1], false);
    assert.equal(fixed.days[2].drive, null);
    assert.equal(fixed.days.length, nz.days.length, "a repeated day and days without an id are left out");
    assert.equal(normalizeTrip({ trip: 3, days: nz.days }), null);
    assert.equal(normalizeTrip({ trip: {}, days: [] }), null);
  });

  it("keeps only this site's pictures and web links", () => {
    const shared = structuredClone(nz);
    shared.days[0].coverImageUrl = "https://example.invalid/pixel.gif";
    shared.days[0].cityImageUrl = "//example.invalid/pixel.gif";
    shared.trip.coverImageUrl = "data:image/gif;base64,AAAA";
    shared.days[0].blocks[0].resources = [{ id: "a", type: "map", title: "地图", url: "javascript:alert(1)" }, { id: "b", type: "map", title: "地图", url: "https://maps.example/x" }];
    const { data } = readImport(exportFile(shared, "nz"), "nz");
    assert.equal(data.days[0].coverImageUrl, "");
    assert.equal(data.days[0].cityImageUrl, "");
    assert.equal(data.trip.coverImageUrl, "");
    assert.deepEqual(data.days[0].blocks[0].resources.map((item) => item.url), ["", "https://maps.example/x"]);
  });
});

describe("opening a saved file", () => {
  it("opens a file on its own page, with the version it was made from and its ticks", () => {
    const file = exportFile(nz, "nz", { baseVersion: "old123", checks: { a: true, b: false }, prep: { added: [{ id: "x", title: "换外币" }], hidden: ["t1"] } });
    const opened = readImport(file, "nz");
    assert.deepEqual(opened.data, nz);
    assert.equal(opened.baseVersion, "old123");
    assert.deepEqual(opened.checks, { a: true });
    assert.deepEqual(opened.prep, { added: [{ id: "x", title: "换外币", detail: "" }], hidden: ["t1"] });
  });

  it("says which page a file of another route belongs to instead of opening it", () => {
    const cases = [
      [exportFile(au2026, "au2026"), "nz", "/au2026/days"],
      [exportFile(nz, "nz"), "au2026", "/nz"],
      [exportFile(plan, "mine"), "nz", "/mine"],
      [exportFile(plan, "mine"), "au2026", "/mine"],
      [exportFile(nz, "nz"), "mine", "/nz"],
      [JSON.stringify(au2026), "mine", "/au2026/days"],
      // Labelled with the wrong route by an older site version (no route mark): what is inside decides.
      [JSON.stringify({ format: "trip-share", trip: "au2026", data: nz }), "au2026", "/nz"],
    ];
    for (const [file, page, href] of cases) {
      assert.throws(() => readImport(file, page), (error) => error instanceof ImportError && error.page?.href === href && /存的文件/.test(error.message), `${page} ← ${href}`);
    }
    assert.throws(() => readImport(JSON.stringify({ trip: "other", data: nz }), "nz"), /不是这个网站存的/);
  });

  it("opens an older file without a route name on the page it fits", () => {
    assert.deepEqual(readImport(JSON.stringify({ data: nz }), "nz").data, nz);
    assert.deepEqual(readImport(JSON.stringify(plan), "mine").data, plan);
  });
});

describe("the copy kept in this browser", () => {
  it("is ignored, not shown, when it belongs to another route or is broken", () => {
    const storage = memoryStorage();
    // Saved by an older version of the site, before files were checked: a New Zealand file on the 2026 page.
    storage.setItem(storageKey("au2026"), JSON.stringify({ baseVersion: nz.version, savedAt: "", data: nz }));
    assert.deepEqual(readCopy(storage, "au2026"), { copy: null, problem: true });
    storage.setItem(storageKey("au2026"), JSON.stringify({ trip: "nz", baseVersion: "", data: au2026 }));
    assert.equal(loadCopy(storage, "au2026"), null);
    storage.setItem(storageKey("mine"), JSON.stringify({ data: { ...plan, days: "broken" } }));
    assert.equal(readCopy(storage, "mine").problem, true);
    // An older site version saved an empty plan when a checklist item was added before any plan existed.
    storage.setItem(storageKey("mine"), JSON.stringify({ trip: "mine", baseVersion: "mine", data: { version: "mine", trip: { title: "方案" }, stages: [], days: [], prep: { added: [{ id: "x", title: "换外币" }] } } }));
    // Its checklist is handed on to the next plan (see stored-edits.test.mjs).
    assert.deepEqual(readCopy(storage, "mine"), { copy: null, problem: false, leftover: { prep: { added: [{ id: "x", title: "换外币", detail: "" }], hidden: [] } } });
    storage.setItem(storageKey("mine"), JSON.stringify({ trip: "mine", baseVersion: "mine", data: { version: "mine", trip: { title: "方案" }, stages: [], days: [] } }));
    assert.deepEqual(readCopy(storage, "mine"), { copy: null, problem: false });
    assert.deepEqual(readCopy(memoryStorage(), "nz"), { copy: null, problem: false });
  });

  it("records the route and when it was saved", () => {
    const storage = memoryStorage();
    const savedAt = saveCopy(storage, "mine", plan, "mine", new Date("2030-03-01T00:00:00Z"));
    assert.equal(savedAt, "2030-03-01T00:00:00.000Z");
    assert.equal(JSON.parse(storage.getItem(storageKey("mine"))).trip, "mine");
    assert.equal(loadCopy(storage, "mine").savedAt, savedAt);
  });
});

// Every text or number in a trip, with where it sits. Day and stage ids are left out: without them
// the whole day or stage is dropped, which the test above covers.
function leaves(value, path = []) {
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, [...path, index]));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => leaves(item, [...path, key]));
  const structural = path.at(-1) === "id" && (path[0] === "days" || path[0] === "stages") && path.length === 3;
  return (typeof value === "string" || typeof value === "number") && !structural ? [{ path, kind: typeof value }] : [];
}
const at = (value, path) => path.reduce((item, key) => (item === undefined || item === null ? undefined : item[key]), value);
function put(value, path, next) {
  at(value, path.slice(0, -1))[path.at(-1)] = next;
}
// What a page could not print: anything but text, a number, or nothing.
const unprintable = (value) => value !== undefined && value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean";

describe("a hand-edited file or an old copy with odd values", () => {
  const routes = [["nz", nz], ["mine", plan]];
  const odd = [{ nested: true }, ["a", "b"], 7];

  for (const [route, original] of routes) {
    it(`gives the ${route} pages text where they print text and numbers where they count`, () => {
      for (const replacement of odd) {
        const edited = structuredClone(original);
        const spots = leaves(original);
        for (const { path } of spots) put(edited, path, structuredClone(replacement));
        const { data } = readImport(exportFile(edited, route), route);
        const wrong = spots
          .map(({ path, kind }) => ({ path, kind, value: at(data, path) }))
          .filter(({ kind, value }) => (kind === "number" ? value !== undefined && !Number.isFinite(value) : unprintable(value)))
          .map(({ path }) => path.join("."));
        assert.deepEqual(wrong, [], `${JSON.stringify(replacement)} left in place`);
      }
    });
  }

  it("opens a file whose tips, stays, checklist and bookings hold objects, lists or numbers", () => {
    const edited = structuredClone(nz);
    edited.advice[0].title = { x: 1 };
    edited.advice[0].detail = ["a"];
    edited.advice[1].resources = [{ title: { x: 1 }, url: ["https://example.com"] }, "loose"];
    edited.lodgings[0].name = { x: 1 };
    edited.lodgings[0].room = 3;
    edited.lodgings[0].resource = "map";
    edited.lodgings[1].fromDay = { x: 1 };
    edited.todos[0].title = ["a"];
    edited.todos[1].dueLabel = { x: 1 };
    edited.dining[0].place = { x: 1 };
    edited.dining[0].resources = [{ type: { x: 1 } }];
    const { data } = readImport(exportFile(edited, "nz"), "nz");
    assert.equal(data.advice[0].title, "");
    assert.equal(data.advice[0].detail, "");
    assert.deepEqual(data.advice[1].resources, [{ title: "", url: "" }]);
    assert.equal(data.lodgings[0].name, "");
    assert.equal(data.lodgings[0].room, "3");
    assert.equal("resource" in data.lodgings[0], false);
    assert.equal("fromDay" in data.lodgings[1], false);
    assert.equal(data.todos[0].title, "");
    assert.equal(data.todos[1].dueLabel, "");
    assert.equal(data.dining[0].place, "");
    assert.equal(data.dining[0].resources[0].type, "");
    // The text export reads the same fields as the pages.
    const text = tripToMarkdown(data);
    assert.doesNotMatch(text, /\[object Object\]/);
  });

  it("reads such a copy back from this browser the same way", () => {
    const storage = memoryStorage();
    const edited = structuredClone(nz);
    edited.advice[0].verdict = { x: 1 };
    edited.lodgings[0].detail = ["a"];
    edited.todos[0].detail = { x: 1 };
    edited.dining[0].note = { x: 1 };
    saveCopy(storage, "nz", edited, nz.version);
    const { copy, problem } = readCopy(storage, "nz");
    assert.equal(problem, false);
    assert.equal(copy.data.advice[0].verdict, "");
    assert.equal(copy.data.lodgings[0].detail, "");
    assert.equal(copy.data.todos[0].detail, "");
    assert.equal(copy.data.dining[0].note, "");
  });

  it("keeps only numbers in the visitor's own budget lines", () => {
    const edited = structuredClone(plan);
    edited.plan.budget = { food: { AUD: 300, NZD: "lots", CNY: { x: 1 } }, car: "cheap", flight: [1] };
    const { data } = readImport(exportFile(edited, "mine"), "mine");
    assert.deepEqual(data.plan.budget, { food: { AUD: 300 } });
  });
});
