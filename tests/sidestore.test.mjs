import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checksAfterOpen, checksKey, emptyPrep, mergePrep, prepKey, readChecks, readPrep, writeChecks, writePrep } from "../src/lib/sideStore.js";

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe("checklist changes kept next to a route", () => {
  it("stores ticks and our route's removed and added items under their own keys", () => {
    const storage = memoryStorage();
    writeChecks(storage, "nz", { a: true, b: false });
    writePrep(storage, "nz", { hidden: ["t1"], added: [{ id: "m1", title: "换外币" }] });
    assert.deepEqual(readChecks(storage, "nz"), { a: true });
    assert.deepEqual(readPrep(storage, "nz"), { hidden: ["t1"], added: [{ id: "m1", title: "换外币", detail: "" }] });
    assert.equal(storage.getItem("trip-share:nz:v1"), null, "the route itself is not copied");
    assert.equal(checksKey("nz"), "trip-share:nz:checks");
    assert.equal(prepKey("nz"), "trip-share:nz:prep");
  });

  it("reads broken or missing entries as empty", () => {
    const storage = memoryStorage();
    storage.setItem(checksKey("nz"), "{broken");
    storage.setItem(prepKey("nz"), JSON.stringify({ hidden: "t1", added: [null, { title: "no id" }] }));
    assert.deepEqual(readChecks(storage, "nz"), {});
    assert.deepEqual(readPrep(storage, "nz"), { added: [], hidden: [] });
    assert.ok(emptyPrep(readPrep(storage, "nz")));
  });

  it("merges what an older copy kept with what is stored apart, once each", () => {
    const merged = mergePrep({ hidden: ["a"], added: [{ id: "x", title: "1" }] }, { hidden: ["a", "b"], added: [{ id: "x", title: "1" }, { id: "y", title: "2" }] }, null);
    assert.deepEqual(merged, { hidden: ["a", "b"], added: [{ id: "x", title: "1" }, { id: "y", title: "2" }] });
  });

  it("replaces a plan's ticks with the opened file's, and joins them on our routes", () => {
    assert.deepEqual(checksAfterOpen({ old: true, both: true }, { both: true, fresh: true }, true), { both: true, fresh: true });
    assert.deepEqual(checksAfterOpen({ old: true }, {}, true), {});
    assert.deepEqual(checksAfterOpen({ old: true }, { fresh: true }, false), { old: true, fresh: true });
    assert.deepEqual(checksAfterOpen(null, null, false), {});
  });
});
