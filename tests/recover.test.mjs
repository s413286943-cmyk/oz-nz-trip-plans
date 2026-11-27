import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { readImport } from "../src/lib/edits.js";
import { routeForPath, savedAsFile, savedKeysFor } from "../src/lib/recover.js";

const nz = JSON.parse(readFileSync(new URL("../data/nz.json", import.meta.url), "utf8"));
const au2026 = JSON.parse(readFileSync(new URL("../data/au2026.json", import.meta.url), "utf8"));
const storage = (entries) => ({ getItem: (key) => entries[key] ?? null });

describe("the page shown when a page fails", () => {
  it("knows which saved copy each page reads", () => {
    assert.equal(routeForPath("/nz/prep"), "nz");
    assert.equal(routeForPath("/au2026"), "au2026");
    assert.equal(routeForPath("/mine/budget"), "mine");
    assert.equal(routeForPath("/"), "");
    assert.equal(routeForPath("/nzx"), "");
    assert.deepEqual(savedKeysFor("/au2026/days"), ["trip-share:au2026:v1"]);
    assert.deepEqual(savedKeysFor("/plan"), ["trip-share:mine:route", "trip-share:mine:v1"]);
    assert.deepEqual(savedKeysFor("/method"), []);
  });

  it("turns the saved copy into a file that opens again on its page", () => {
    const saved = storage({ "trip-share:nz:v1": JSON.stringify({ baseVersion: "abc", savedAt: "", data: nz }) });
    const opened = readImport(savedAsFile(saved, "/nz"), "nz");
    assert.deepEqual(opened.data, nz);
    assert.equal(opened.baseVersion, "abc");
    assert.equal(savedAsFile(storage({}), "/nz"), "");
    assert.equal(savedAsFile(storage({ "trip-share:nz:v1": "{broken" }), "/nz"), "{broken");
  });

  it("labels a rescued file by what is in it, so a copy kept under the wrong route still opens", () => {
    // An older site version kept the New Zealand route under the 2026 key, with no route name.
    const misplaced = storage({ "trip-share:au2026:v1": JSON.stringify({ baseVersion: "v", savedAt: "", data: nz }) });
    const file = savedAsFile(misplaced, "/au2026/days");
    assert.equal(JSON.parse(file).trip, "nz");
    assert.deepEqual(readImport(file, "nz").data, nz);
    assert.throws(() => readImport(file, "au2026"), (error) => error.page?.href === "/nz");
    assert.throws(() => readImport(file, "mine"), (error) => error.page?.href === "/nz");
    // A file such a copy produced on the older site, still labelled with the page it came from.
    const oldFile = JSON.stringify({ format: "trip-share", trip: "au2026", data: nz });
    assert.deepEqual(readImport(oldFile, "nz").data, nz);
    assert.throws(() => readImport(oldFile, "au2026"), (error) => error.page?.href === "/nz");
    // Saved under its own key it keeps its own route.
    const own = storage({ "trip-share:au2026:v1": JSON.stringify({ trip: "au2026", baseVersion: "", data: au2026 }) });
    assert.equal(JSON.parse(savedAsFile(own, "/au2026")).trip, "au2026");
    assert.deepEqual(readImport(savedAsFile(own, "/au2026"), "au2026").data, au2026);
  });
});
