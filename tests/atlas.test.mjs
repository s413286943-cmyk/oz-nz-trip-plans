import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { atlasLayout, shortDay, stageRange } from "../src/lib/atlas.js";
import { addDay, moveDay, removeDay } from "../src/lib/edits.js";

const au2026 = JSON.parse(readFileSync(new URL("../data/au2026.json", import.meta.url), "utf8"));
const shown = (layout) => [...layout.out, ...layout.stages.flatMap((item) => item.days), ...layout.home].map((day) => day.id);

describe("the 2026 page with the visitor's changes", () => {
  it("shows our 17 days as before: the flight out, three stages, the flight home", () => {
    const layout = atlasLayout(au2026.stages, au2026.days);
    assert.deepEqual(layout.out.map((day) => day.id), ["d0"]);
    assert.deepEqual(layout.home.map((day) => day.id), ["d16"]);
    assert.equal(layout.stages.length, 3);
    assert.deepEqual(shown(layout), au2026.days.map((day) => day.id));
    assert.equal(shortDay(au2026.days[0]), "07.28");
    assert.match(stageRange(layout.stages[0].days), / · 07\.29-08\.02$/);
  });

  it("shows a day added anywhere, with or without a date", () => {
    for (const after of ["d0", "d5", "d16"]) {
      const edited = addDay(au2026, after);
      const added = edited.days.find((day) => day.id.startsWith("mine-"));
      const layout = atlasLayout(edited.stages, edited.days);
      assert.deepEqual(shown(layout).sort(), edited.days.map((day) => day.id).sort(), after);
      if (!added.date) assert.equal(shortDay(added), "日期待定");
      for (const item of layout.stages) assert.doesNotThrow(() => stageRange(item.days));
    }
  });

  it("still shows every day after days are moved or removed", () => {
    let edited = moveDay(au2026, "d0", 1);
    edited = removeDay(edited, "d8");
    assert.deepEqual(shown(atlasLayout(edited.stages, edited.days)).sort(), edited.days.map((day) => day.id).sort());
    assert.deepEqual(shown(atlasLayout([], edited.days)), edited.days.map((day) => day.id));
  });

  it("gives a range without dates when a stage has an undated day", () => {
    assert.equal(stageRange([{ label: "D07" }, { label: "D08", date: "2026-08-03" }]), "D07-D08");
    assert.equal(stageRange([]), "");
  });
});
