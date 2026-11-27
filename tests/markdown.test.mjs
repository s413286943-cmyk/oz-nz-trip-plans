import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, ownTimeline, presetStops } from "../src/lib/compose.js";
import { tripToMarkdown } from "../src/lib/markdown.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const nz = read("data/nz.json");
const au2026 = read("data/au2026.json");
const library = read("data/places.json");

describe("the text version follows what the pages show", () => {
  it("keeps the map and booking links and the travel tips", () => {
    const text = tripToMarkdown(nz);
    const url = nz.days.flatMap((day) => day.blocks).flatMap((block) => block.resources).find((item) => /^https:/.test(item.url)).url;
    assert.ok(text.includes(`](${url.replace(/[()\s|]/g, encodeURIComponent)})`));
    assert.match(text, /## 出行提示/);
    for (const item of nz.advice) assert.ok(text.includes(item.title), item.title);
  });

  it("lists our route's checklist with its ticks, without removed items, with added ones", () => {
    const [first, second] = nz.todos;
    const text = tripToMarkdown(nz, { checks: { [second.id]: true, mine1: true }, prep: { hidden: [first.id], added: [{ id: "mine1", title: "换外币现金", detail: "" }] } });
    assert.match(text, /## 出发前清单/);
    assert.ok(!text.includes(`- [ ] ${first.dueLabel ? `**${first.dueLabel}** ` : ""}${first.title}`));
    assert.ok(text.includes(`- [x] ${second.dueLabel ? `**${second.dueLabel}** ` : ""}${second.title}`));
    assert.match(text, /## 自己加的事\n\n- \[x\] 换外币现金/);
  });

  it("gives a plan's bookings the ticks, removals and the late note of the checklist page", () => {
    const data = composePlan(library, { nz, au2026 }, { stops: presetStops(library, "nz"), startDate: "2030-04-08", adults: 2, children: 0, rooms: 1, cars: 1, pace: "easy" });
    const items = ownTimeline(library, data, "2030-04-08", "2030-04-01");
    const late = items.find((item) => item.late);
    const removed = items.find((item) => item !== late);
    const text = tripToMarkdown(data, { library, today: "2030-04-01", prep: { hidden: [`plan:${removed.id}`], added: [] }, checks: {} });
    assert.ok(text.includes(`${late.title}`) && text.includes("（已经过了，尽快）"));
    assert.ok(!text.includes(`** ${removed.title}`), "a removed item is not listed");
    const ticked = tripToMarkdown(data, { library, today: "2030-04-01", checks: { [`plan:${late.id}`]: true } });
    const tickedLine = ticked.split("\n").find((row) => row.includes(` ${late.title}`) && row.startsWith("- ["));
    assert.ok(tickedLine.startsWith("- [x]") && !tickedLine.includes("已经过了"), tickedLine);
    const parked = data.days.find((day) => day.parked?.length);
    assert.ok(parked, "the slower pace sets steps aside");
    assert.ok(text.includes("**收起来的「可加」**") && text.includes(parked.parked[0].place));
  });
});
