import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  MEAL_PERIOD,
  addBlock,
  addNote,
  clearCopy,
  exportFile,
  loadCopy,
  moveBlock,
  parseImport,
  removeBlock,
  removeNote,
  saveCopy,
  setMeals,
  updateBlock,
  updateDay,
  updateNote,
  validTrip,
} from "../src/lib/edits.js";
import { mealPairs, parseMealPlan } from "../src/lib/format.js";
import { tripToMarkdown } from "../src/lib/markdown.js";

const nz2027 = JSON.parse(readFileSync(new URL("../data/nz2027.json", import.meta.url), "utf8"));
const au2026 = JSON.parse(readFileSync(new URL("../data/au2026.json", import.meta.url), "utf8"));

const timeline = (data, dayId) => data.days.find((day) => day.id === dayId).blocks.filter((block) => block.period !== MEAL_PERIOD);
const dayOf = (data, dayId) => data.days.find((day) => day.id === dayId);

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe("editing a trip copy", () => {
  it("both trips load as valid trips with unique block ids", () => {
    for (const trip of [nz2027, au2026]) {
      assert.ok(validTrip(trip));
      const ids = trip.days.flatMap((day) => day.blocks.map((block) => block.id));
      assert.equal(new Set(ids).size, ids.length);
      assert.match(trip.version, /^[0-9a-f]{12}$/);
    }
  });

  it("changes a step and a day without touching the original", () => {
    const first = timeline(nz2027, "d1")[0];
    const next = updateDay(updateBlock(nz2027, "d1", first.id, { place: "我的地点" }), "d1", { title: "我的标题" });
    assert.equal(timeline(next, "d1")[0].place, "我的地点");
    assert.equal(dayOf(next, "d1").title, "我的标题");
    assert.notEqual(timeline(nz2027, "d1")[0].place, "我的地点");
  });

  it("adds, moves and removes steps, keeping the meals line last", () => {
    const [a, b] = timeline(au2026, "d3");
    let next = addBlock(au2026, "d3", a.id);
    const added = timeline(next, "d3")[1];
    assert.equal(added.place, "");
    assert.equal(timeline(next, "d3")[2].id, b.id);
    next = moveBlock(next, "d3", added.id, -1);
    assert.equal(timeline(next, "d3")[0].id, added.id);
    assert.deepEqual(timeline(moveBlock(next, "d3", added.id, -1), "d3").map((block) => block.id), timeline(next, "d3").map((block) => block.id));
    next = removeBlock(next, "d3", added.id);
    assert.deepEqual(timeline(next, "d3").map((block) => block.id), timeline(au2026, "d3").map((block) => block.id));
    const blocks = dayOf(next, "d3").blocks;
    if (blocks.some((block) => block.period === MEAL_PERIOD)) assert.equal(blocks.at(-1).period, MEAL_PERIOD);
    assert.deepEqual(blocks.map((block) => block.sortOrder), blocks.map((_, index) => (index + 1) * 10));
  });

  it("edits the meals line and the day notes", () => {
    let next = setMeals(nz2027, "d2", "早餐：咖啡；晚餐：自己做");
    assert.deepEqual(parseMealPlan(dayOf(next, "d2").blocks.find((block) => block.period === MEAL_PERIOD).activity), { breakfast: "咖啡", lunch: "", dinner: "自己做" });
    const count = dayOf(next, "d2").notes.length;
    next = addNote(next, "d2");
    next = updateNote(next, "d2", count, { label: "我的", text: "带伞" });
    assert.deepEqual(dayOf(next, "d2").notes.at(-1), { label: "我的", text: "带伞" });
    next = removeNote(next, "d2", count);
    assert.equal(dayOf(next, "d2").notes.length, count);
  });

  it("saves to storage, round-trips an exported file and rejects other files", () => {
    const storage = memoryStorage();
    assert.equal(loadCopy(storage, "nz2027"), null);
    const edited = updateDay(nz2027, "d1", { title: "存一下" });
    saveCopy(storage, "nz2027", edited, nz2027.version);
    const loaded = loadCopy(storage, "nz2027");
    assert.equal(loaded.baseVersion, nz2027.version);
    assert.equal(dayOf(loaded.data, "d1").title, "存一下");
    assert.equal(dayOf(parseImport(exportFile(edited, "nz2027")), "d1").title, "存一下");
    assert.throws(() => parseImport("not json"), /不是导出的行程文件/);
    assert.throws(() => parseImport("{\"days\": []}"), /没有找到每天的行程/);
    storage.setItem("trip-share:nz2027:v1", "{broken");
    assert.equal(loadCopy(storage, "nz2027"), null);
    clearCopy(storage, "nz2027");
    assert.equal(loadCopy(storage, "nz2027"), null);
  });
});

describe("text helpers", () => {
  it("splits meals on the first colon only", () => {
    assert.deepEqual(mealPairs("早餐：咖啡；晚餐：Margaret（已订 18:00）"), [["早餐", "咖啡"], ["晚餐", "Margaret（已订 18:00）"]]);
  });

  it("exports both trips as Markdown with every day and the edits", () => {
    for (const trip of [nz2027, au2026]) {
      const markdown = tripToMarkdown(trip);
      assert.ok(markdown.startsWith(`# ${trip.trip.title}`));
      for (const day of trip.days) assert.ok(markdown.includes(`## ${day.label} ·`), day.id);
    }
    const edited = updateDay(nz2027, "d5", { title: "我改的第五天" });
    assert.match(tripToMarkdown(edited), /我改的第五天/);
    assert.match(tripToMarkdown(nz2027), /\| 时间 \| 地点 \| 安排 \|/);
  });
});
