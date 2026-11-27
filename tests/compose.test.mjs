import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { addDays, weekdayOf } from "../src/lib/dates.js";
import { carChains, composePlan, estimateOwnBudget, hop, nextFrom, ownTimeline, presetStops, reviewRoute } from "../src/lib/compose.js";
import { addDay, removeDay } from "../src/lib/edits.js";
import { tripToMarkdown } from "../src/lib/markdown.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };

const id = (name) => library.places.find((place) => place.name.startsWith(name)).id;
const stops = (...list) => list.map(([name, nights], index) => (
  typeof name === "object" ? { key: `s${index + 1}`, ...name, nights } : { key: `s${index + 1}`, placeId: id(name), nights }
));
const settings = (list, patch = {}) => ({ stops: list, startDate: "2030-03-04", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours", ...patch });
const froms = (data) => data.days.map((day) => day.from || "");

describe("our two routes, laid out as stops", () => {
  it("the New Zealand preset gives back our 17 days in order", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz")));
    assert.deepEqual(froms(data), sources.nz.days.map((day) => `nz:${day.id}`));
    assert.equal(data.days[0].date, "2030-03-04");
    assert.equal(data.days.at(-1).date, addDays("2030-03-04", 16));
    for (const day of data.days) assert.equal(day.weekday, weekdayOf(day.date));
    assert.deepEqual(data.days.map((day) => day.dayNumber), data.days.map((_, index) => index + 1));
  });

  it("the Australia preset gives back our days from landing in Melbourne", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "au2026"), { adults: 4, rooms: 2 }));
    assert.deepEqual(froms(data), sources.au2026.days.slice(1).map((day) => `au:${day.id}`));
  });

  it("costs for our own routes come back close to what we spent", () => {
    const nz = composePlan(library, sources, settings(presetStops(library, "nz")));
    const budget = estimateOwnBudget(library, nz, { adults: 2, rooms: 1, cars: 1 });
    const line = (kind) => budget.lines.find((item) => item.kind === kind).amounts;
    assert.equal(line("flight").CNY, 22960);
    // Nightly prices of the New Zealand route are published rounded to tens.
    assert.ok(Math.abs(line("lodging").CNY - 8804.01) < 60, `lodging ${line("lodging").CNY}`);
    assert.ok(Math.abs(line("lodging").NZD - 1008) < 30, `lodging ${line("lodging").NZD}`);
    assert.equal(budget.counts.carDays, 9);
    assert.ok(Math.abs(line("car").CNY - 3382) < 0.1);

    const au = composePlan(library, sources, settings(presetStops(library, "au2026"), { adults: 4, rooms: 2 }));
    assert.equal(estimateOwnBudget(library, au, { adults: 4, rooms: 2, cars: 1 }).counts.carDays, 6);
  });
});

describe("a route of the visitor's own", () => {
  it("uses our arrival day when we drove the same road, and our days at the place", () => {
    const data = composePlan(library, sources, settings(stops(["基督城", 2], ["Twizel", 3], ["皇后镇", 2])));
    assert.equal(data.days[2].from, "nz:d5", "Christchurch → Twizel is our day 5");
    assert.deepEqual(froms(data).slice(3, 5), ["nz:d6", "nz:d7"]);
    // Twizel → Queenstown we never drove: an arrival day of its own, saying so.
    const arrival = data.days[5];
    assert.equal(arrival.from, undefined);
    assert.match(arrival.notes.map((note) => note.text).join(""), /没走过/);
    assert.equal(data.days[1].title, "在基督城多留一天");
  });

  it("a road we drove the other way round is used, with a word about the direction", () => {
    const data = composePlan(library, sources, settings(stops(["皇后镇", 2], ["Te Anau", 2], ["奥克兰", 2])));
    const arrival = data.days[2];
    assert.match(arrival.transport, /2–2\.5 小时/);
    assert.ok(arrival.notes.some((note) => /反方向/.test(note.text)));
    assert.ok(data.days.some((day) => day.from === "nz:d11"), "Milford is on the Te Anau day");
  });

  it("a place we never went gets blank days and an arrival that says to look it up", () => {
    const own = { placeId: "", name: "Dunedin", country: "nz" };
    const data = composePlan(library, sources, settings(stops(["基督城", 1], [own, 2], ["皇后镇", 2])));
    const dunedin = data.days.filter((day) => day.stopKey === "s2");
    assert.equal(dunedin.length, 2);
    assert.match(dunedin[0].notes[0].text, /没走过/);
    assert.equal(data.lodgings[1].name, "Dunedin的住处");
  });

  it("our mentions of day numbers follow the visitor's numbering, or say they were ours", () => {
    const data = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 3], ["Wānaka", 2], ["Te Anau", 2], ["皇后镇", 2], ["奥克兰", 3])));
    const text = JSON.stringify([data.days, data.advice]);
    // Our day 14 (fly to Auckland) is the visitor's day 11: no Sydney, an arrival day of their own.
    assert.equal(data.days.findIndex((day) => day.from === "nz:d14") + 1, 11);
    assert.ok(!/第 14 天晚饭后/.test(text));
    assert.ok(/第 11 天晚饭后/.test(text), "the tip about our day 14 points at the visitor's day 11");
  });

  it("days we did at a place but the visitor has no room for are listed on the last day there", () => {
    const data = composePlan(library, sources, settings(stops(["悉尼", 2])));
    const last = data.days.filter((day) => day.stopKey === "s1").at(-1);
    assert.ok(last.notes.some((note) => note.label === "这里还能做" && /Taronga/.test(note.text)));
  });

  it("the car is with you between the stops joined by roads, plus our one-day rentals", () => {
    const route = stops(["基督城", 1], ["Twizel", 2], ["Wānaka", 2], ["皇后镇", 1], ["奥克兰", 2]);
    assert.deepEqual(carChains(library, route), [{ start: 0, end: 3 }]);
    const data = composePlan(library, sources, settings(route));
    assert.equal(data.days.filter((day) => day.car).length, 5);
    assert.ok(data.days.some((day) => day.notes?.some((note) => note.label === "还车")));
  });

  it("the slower pace parks the optional steps", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz"), { pace: "easy" }));
    assert.ok(data.days.find((day) => day.from === "nz:d9").parked.length >= 3);
  });

  it("days can still be added and removed afterwards, and the budget follows", () => {
    let data = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 2], ["皇后镇", 2], ["奥克兰", 2])));
    const before = estimateOwnBudget(library, data, { adults: 2, rooms: 1, cars: 1 });
    const twizel = data.days.find((day) => day.from === "nz:d6");
    data = addDay(data, twizel.id);
    const after = estimateOwnBudget(library, data, { adults: 2, rooms: 1, cars: 1 });
    assert.equal(after.lines.find((line) => line.kind === "lodging").amounts.NZD, before.lines.find((line) => line.kind === "lodging").amounts.NZD + library.places.find((place) => place.id === id("Twizel")).lodging.amounts.NZD);
    assert.equal(after.counts.carDays, before.counts.carDays + 1);
    data = removeDay(data, data.days[1].id);
    assert.equal(data.days[1].date, "2030-03-05");
  });
});

describe("route checks", () => {
  const texts = (route) => reviewRoute(library, route).map((note) => note.text).join("\n");

  it("says when a must-do place has no full day, or no spare day for the weather", () => {
    assert.match(texts(stops(["基督城", 1], ["Twizel", 1], ["皇后镇", 2])), /Twizel只住一晚，排不进「Mt Cook/);
    assert.match(texts(stops(["基督城", 1], ["Twizel", 2], ["皇后镇", 2])), /看天气：多住一晚/);
  });

  it("flags long drives, moving every night, roads we never took and stops without flights", () => {
    const text = texts(stops(["Wānaka", 1], ["Te Anau", 1], ["Twizel", 1], ["基督城", 1]));
    assert.match(text, /没有国际航班，第一站/);
    assert.match(text, /长途/);
    assert.match(text, /只住一晚：搬家太频繁/);
    assert.match(text, /Te Anau → Twizel：参考路线没走过这段/);
  });

  it("knows 皇后镇 flies only to Australia, and says so instead of 'no international flights'", () => {
    const text = texts(stops(["基督城", 1], ["Twizel", 3], ["Wānaka", 2], ["皇后镇", 2]));
    assert.doesNotMatch(text, /皇后镇没有国际航班/);
    assert.match(text, /皇后镇只有飞澳洲的国际航班/);
    const opening = texts(stops(["皇后镇", 2], ["Te Anau", 2], ["奥克兰", 2]));
    assert.match(opening, /皇后镇只有从澳洲飞来的国际航班/);
    assert.match(opening, /从国内去要在澳洲或奥克兰转机/, "New Zealand alone needs no Australian stop");
    assert.equal(hop(library, stops(["悉尼", 1])[0], stops(["皇后镇", 1])[0]).mode, "flight");
  });

  it("adds season notes only when the first day puts a stop in those months", () => {
    const south = stops(["基督城", 1], ["Twizel", 2], ["Wānaka", 2], ["Te Anau", 2], ["皇后镇", 2]);
    const at = (route, start) => reviewRoute(library, route, start).map((note) => note.text).join("\n");
    assert.doesNotMatch(at(south, ""), /雪链|防蜇/, "no first day, no season notes");
    const winter = reviewRoute(library, south, "2030-06-10");
    const snow = winter.filter((note) => /雪链/.test(note.text));
    assert.equal(snow.length, 2, "South Island passes once, Milford Road once");
    assert.equal(snow.find((note) => /Milford Road/.test(note.text)).at, 3, "at Te Anau");
    assert.equal(snow.find((note) => /Lindis Pass/.test(note.text)).at, 1, "at the first South Island inland stop");
    assert.doesNotMatch(at(south, "2030-03-04"), /雪链/, "autumn");
    // Milford Road can still ask for chains in spring, after the passes' winter note ends.
    assert.match(at(south, "2030-10-20"), /Milford Road/);
    assert.doesNotMatch(at(south, "2030-10-20"), /Lindis Pass/);
    // The month of each night counts: a stop that starts in late May reaches June.
    assert.match(at(stops(["基督城", 1], ["Twizel", 2], ["Wānaka", 2], ["Te Anau", 2]), "2030-05-28"), /Lindis Pass/);
    const cairns = stops(["凯恩斯", 3]);
    assert.match(at(cairns, "2030-11-10"), /防蜇网/);
    assert.doesNotMatch(at(cairns, "2030-09-01"), /防蜇/);
    for (const note of winter) assert.doesNotMatch(note.text, /\d\s*月/, "notes say no month");
  });

  it("does not take the reference Great Ocean Road days for two long drives in a row", () => {
    const text = texts(presetStops(library, "au2026"));
    assert.doesNotMatch(text, /连着两天开长途/);
    const leg = library.legs.find((item) => item.from === id("Apollo Bay") && item.to === id("Port Campbell"));
    assert.ok(leg.hours < 2, "the direct drive, not the day's detour");
    assert.match(leg.note, /213 公里/);
  });

  it("knows a flight from a drive, and suggests where we drove next", () => {
    assert.equal(hop(library, stops(["悉尼", 1])[0], stops(["基督城", 1])[0]).mode, "flight");
    assert.equal(hop(library, stops(["Twizel", 1])[0], stops(["Wānaka", 1])[0]).mode, "drive");
    const next = nextFrom(library, id("Twizel")).map((item) => item.placeId);
    assert.ok(next.includes(id("基督城")) && next.includes(id("Wānaka")));
  });
});

describe("bookings, getting ready and the text export", () => {
  it("lists what to book for the days the visitor kept, on their dates", () => {
    const data = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 2], ["Wānaka", 2], ["Te Anau", 2], ["皇后镇", 2], ["奥克兰", 2])));
    const items = ownTimeline(library, data, "2030-03-04", "2029-11-20");
    const titles = items.map((item) => item.title).join("|");
    assert.match(titles, /Milford/);
    assert.match(titles, /NZeTA/);
    assert.match(titles, /订租车/);
    assert.doesNotMatch(titles, /Gidley|外礁/);
    assert.equal(items[0].due, addDays("2030-03-04", -120));
    assert.ok(items.find((item) => item.title.includes("机票")).late);
  });

  it("asks for each country's entry permit, and dates the arrival card by the day of flying in", () => {
    const nzOnly = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 2], ["皇后镇", 2], ["奥克兰", 2])));
    const nzItems = ownTimeline(library, nzOnly, "2030-03-04");
    const permit = nzItems.find((item) => /NZeTA/.test(item.title));
    assert.match(permit.title, /访客签证/);
    assert.match(permit.detail, /从澳洲直飞/);
    assert.ok(!nzItems.some((item) => /澳洲访客签证/.test(item.title)));
    assert.ok(ownTimeline(library, composePlan(library, sources, settings(stops(["悉尼", 3])))).some((item) => /澳洲访客签证/.test(item.title)));
    const both = composePlan(library, sources, settings(stops(["悉尼", 3], ["基督城", 1], ["Twizel", 2])));
    const card = ownTimeline(library, both, "2030-03-04").find((item) => /NZTD/.test(item.title));
    const firstNz = both.days.findIndex((day) => day.country === "nz");
    assert.ok(firstNz > 0);
    assert.equal(card.due, addDays(both.days[firstNz].date, -1));
    assert.equal(card.day.number, firstNz + 1);
    assert.equal(ownTimeline(library, nzOnly, "2030-03-04").find((item) => /NZTD/.test(item.title)).due, addDays("2030-03-04", -1));
  });

  it("lists every meal the reference route booked ahead", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz")));
    const titles = ownTimeline(library, data).map((item) => item.title).join("|");
    for (const place of ["Kika", "Redcliff", "Blue Kanu", "Amano", "Gidley"]) assert.match(titles, new RegExp(place));
  });

  it("skips car items when the visitor never drives", () => {
    const data = composePlan(library, sources, settings(stops(["悉尼", 3])));
    const titles = ownTimeline(library, data).map((item) => item.title).join("|");
    assert.doesNotMatch(titles, /订租车|驾照/);
    assert.match(titles, /歌剧院|Gidley/);
  });

  it("the text export carries the budget and the list", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz")));
    const text = tripToMarkdown(data, { library });
    assert.match(text, /## 预算（估算）/);
    assert.match(text, /## 什么时候订什么、办什么/);
    assert.match(text, /- \[ \] \*\*\d+\/\d+ 前\*\* 订机票/);
  });
});

describe("what a borrowed day keeps of our rental's text", () => {
  it("keeps what to do at pick-up, and a tram that stops running, while our own pick-up goes", () => {
    const twizel = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 1]))).days.find((day) => day.from === "nz:d5");
    assert.ok(twizel, "the drive to Twizel is our day");
    const cover = twizel.notes.find((note) => note.label === "保险")?.text || "";
    assert.match(cover, /取车时在门店加买 MDW（Maximum Damage Waiver）：每天 NZ\$48/);
    assert.match(cover, /取车时问清楚/);
    assert.doesNotMatch(JSON.stringify(twizel), /10:00 取车|上午取车|166 Orchard Road/);
    const city = composePlan(library, sources, settings(presetStops(library, "nz"))).days.find((day) => day.from === "nz:d4");
    assert.ok(city.blocks.some((block) => /电车可能也收车了/.test(block.tip || "")));
    assert.doesNotMatch(JSON.stringify(city), /打车去 ACE 门店/);
  });
});
