import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { copyStore, replay } from "../src/lib/copyStore.js";
import { updateDay } from "../src/lib/edits.js";

const nz = JSON.parse(readFileSync(new URL("../data/nz.json", import.meta.url), "utf8"));
const title = (data, id) => data.days.find((day) => day.id === id).title;

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe("two tabs of the same route", () => {
  it("never lets the second tab write over what the first one saved", () => {
    const storage = memoryStorage();
    const one = copyStore(storage, "nz");
    const two = copyStore(storage, "nz");
    one.load();
    two.load();
    assert.equal(one.save({ baseVersion: nz.version, data: updateDay(nz, "d1", { title: "第一个页面改的" }) }).saved, true);

    // The second tab still shows the original and changes day 2.
    const stale = two.save({ baseVersion: nz.version, data: updateDay(nz, "d2", { title: "第二个页面改的" }) });
    assert.equal(stale.saved, false);
    assert.equal(title(stale.copy.data, "d1"), "第一个页面改的", "it gets the first tab's version back to show");
    assert.equal(title(one.load().copy.data, "d1"), "第一个页面改的", "storage still has the first tab's change");

    // Changing again on the version it now shows keeps both changes.
    assert.equal(two.save({ baseVersion: nz.version, data: updateDay(stale.copy.data, "d2", { title: "第二个页面改的" }) }).saved, true);
    const both = one.load().copy.data;
    assert.deepEqual([title(both, "d1"), title(both, "d2")], ["第一个页面改的", "第二个页面改的"]);
  });

  it("does the change that lost the race again on the other tab's version, so neither is lost", () => {
    const storage = memoryStorage();
    const one = copyStore(storage, "nz");
    const two = copyStore(storage, "nz");
    one.load();
    two.load();
    one.save({ baseVersion: nz.version, data: updateDay(nz, "d1", { title: "第一个页面改的" }) });

    const changes = [(data) => updateDay(data, "d2", { title: "第二个页面改的" }), (data) => updateDay(data, "d3", { focus: "又改一处" })];
    const stale = two.save({ baseVersion: nz.version, data: changes.reduce((data, change) => change(data), nz) });
    assert.equal(stale.saved, false);
    const again = replay(stale.copy, changes);
    assert.equal(two.save(again).saved, true);
    const both = one.load().copy.data;
    assert.deepEqual([title(both, "d1"), title(both, "d2"), both.days.find((day) => day.id === "d3").focus], ["第一个页面改的", "第二个页面改的", "又改一处"]);
  });

  it("does not bring a change back after the other tab cleared the copy, or when it cannot be done again", () => {
    const change = (data) => updateDay(data, "d2", { title: "改" });
    assert.equal(replay(null, [change]), null);
    assert.equal(replay({ baseVersion: nz.version, data: nz }, []), null);
    assert.equal(replay({ baseVersion: nz.version, data: nz }, [() => { throw new Error("gone"); }]), null);
  });

  it("after one tab clears its changes, the other cannot bring them back unseen", () => {
    const storage = memoryStorage();
    const one = copyStore(storage, "nz");
    const two = copyStore(storage, "nz");
    one.load();
    one.save({ baseVersion: nz.version, data: updateDay(nz, "d1", { title: "改过" }) });
    two.load();
    one.clear();
    const result = two.save({ baseVersion: nz.version, data: updateDay(nz, "d3", { title: "又改" }) });
    assert.equal(result.saved, false);
    assert.equal(result.copy, null);
  });
});
