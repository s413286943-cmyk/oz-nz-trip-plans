import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { addDays } from "../src/lib/dates.js";
import { carChains, composePlan, estimateOwnBudget, hop, mergeRepeats, ownTimeline, presetStops, reviewRoute, withoutLease } from "../src/lib/compose.js";
import { MEAL_PERIOD, addDay, canMoveDay, moveDay, removeDay, renumberDays, restoreParked } from "../src/lib/edits.js";
import { startRoute } from "../src/lib/routeDraft.js";
import { mapStops } from "../src/lib/tripDays.js";
import { dayNumber } from "../src/lib/format.js";
import { tripToMarkdown } from "../src/lib/markdown.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const sources = { nz: read("data/nz.json"), au2026: read("data/au2026.json") };
const au2026 = sources.au2026;

const id = (name) => library.places.find((place) => place.name.startsWith(name)).id;
const stops = (...list) => list.map(([name, nights], index) => (
  typeof name === "object" ? { key: `s${index + 1}`, ...name, nights } : { key: `s${index + 1}`, placeId: id(name), nights }
));
const settings = (list, patch = {}) => ({ stops: list, startDate: "2030-03-04", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours", ...patch });
const at = (data, stopKey) => data.days.filter((day) => day.stopKey === stopKey);
const noteText = (day, label) => (day.notes || []).filter((note) => note.label === label).map((note) => note.text).join("");
const line = (budget, kind) => budget.lines.find((item) => item.kind === kind);
const ROUTE_EMPTY = { stops: [], startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" };
const setStart = (data, start) => renumberDays({ ...data, plan: { ...data.plan, startDate: start } });

describe("day numbers in what a plan borrows", () => {
  it("tips and meals point at the visitor's days, not at ours", () => {
    const route = presetStops(library, "nz").filter((stop) => stop.placeId !== id("悉尼"));
    const data = composePlan(library, sources, settings(route));
    assert.ok(data.advice.length > 0);
    for (const item of data.advice) {
      const numbers = [...JSON.stringify(item).matchAll(/第 (\d+) 天/g)].map((match) => Number(match[1]));
      const own = new Set(item.dayIds.map((dayId) => data.days.find((day) => day.id === dayId).dayNumber));
      // A tip about one day names that day (or the evening before it).
      for (const number of numbers) assert.ok(own.has(number) || own.has(number + 1), `${item.title}: 第 ${number} 天 vs ${[...own]}`);
    }
    // Adding a day moves the tips' numbers along with their days.
    const tip = data.advice.find((item) => /第 \d+ 天/.test(item.verdict));
    const before = Number(tip.verdict.match(/\d+/)[0]);
    const after = addDay(data, data.days[0].id).advice.find((item) => item.title === tip.title || item.dayIds.join() === tip.dayIds.join());
    assert.equal(Number(after.verdict.match(/\d+/)[0]), before + 1);
  });

  it("only two nights in Auckland: the tip names the visitor's day 2", () => {
    const data = composePlan(library, sources, settings(stops(["奥克兰", 2])));
    const text = JSON.stringify(data.advice);
    assert.ok(!/第 15 天|第 14 天/.test(text), text.slice(0, 200));
  });

  it("cover descriptions lose our day labels", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz")));
    for (const day of data.days) assert.doesNotMatch(day.coverImageAlt || "", /^D\d/);
  });
});

describe("stays, nights and dates follow the days", () => {
  const route = stops(["基督城", 2], ["Twizel", 2], ["Wānaka", 2]);

  it("a new first day moves every check-in and check-out", () => {
    const data = setStart(composePlan(library, sources, settings(route)), "2030-04-10");
    assert.equal(data.trip.dates, "4月10日起 · 7 天");
    assert.deepEqual(data.lodgings.map((stay) => [stay.checkIn, stay.checkOut]), [
      ["2030-04-10", "2030-04-12"], ["2030-04-12", "2030-04-14"], ["2030-04-14", "2030-04-16"],
    ]);
  });

  it("a day added or removed at a stop changes its nights, the stays after it and the dates line", () => {
    let data = composePlan(library, sources, settings(route));
    const twizel = at(data, "s2").at(-1);
    data = addDay(data, twizel.id);
    assert.equal(data.trip.dates, "3月4日起 · 8 天");
    assert.deepEqual(data.stages.map((stage) => stage.title), ["基督城 · 2 晚", "Twizel · 3 晚", "Wānaka · 2 晚"]);
    assert.deepEqual(data.lodgings.map((stay) => [stay.status, stay.checkIn, stay.checkOut, stay.fromDay, stay.toDay]), [
      ["2 晚", "2030-03-04", "2030-03-06", 1, 3], ["3 晚", "2030-03-06", "2030-03-09", 3, 6], ["2 晚", "2030-03-09", "2030-03-11", 6, 8],
    ]);
    data = removeDay(removeDay(data, at(data, "s2")[0].id), at(data, "s1")[0].id);
    assert.deepEqual(data.stages.map((stage) => stage.title), ["基督城 · 1 晚", "Twizel · 2 晚", "Wānaka · 2 晚"]);
    assert.deepEqual(data.lodgings.map((stay) => stay.checkIn), ["2030-03-04", "2030-03-05", "2030-03-07"]);
    assert.match(tripToMarkdown(data, { library }), /Twizel[^\n]*（3\/5 – 3\/7）/);
  });

  it("clearing the first day clears every date, and later edits keep none", () => {
    let data = setStart(composePlan(library, sources, settings(route)), "");
    assert.equal(data.trip.dates, "7 天");
    assert.ok(data.days.every((day) => !day.date && !day.weekday));
    assert.ok(data.lodgings.every((stay) => !stay.checkIn && !stay.checkOut));
    data = moveDay(addDay(data, data.days[1].id), data.days[2].id, 1);
    assert.ok(data.days.every((day) => !day.date));
  });

  it("a plan saved before stays named their stop still follows the days", () => {
    const fresh = composePlan(library, sources, settings(route));
    const old = { ...fresh, lodgings: fresh.lodgings.map(({ stopKey: _key, ...stay }) => stay) };
    const data = addDay(old, at(old, "s1")[0].id);
    assert.deepEqual(data.lodgings.map((stay) => stay.status), ["3 晚", "2 晚", "2 晚"]);
  });
});

describe("the car on roads we never drove", () => {
  it("a short road in one country keeps the car: no car return in a small town, and the budget counts the days", () => {
    const route = stops(["基督城", 2], ["Twizel", 3], ["皇后镇", 2]);
    assert.deepEqual(carChains(library, route), [{ start: 0, end: 2 }]);
    const data = composePlan(library, sources, settings(route));
    assert.ok(at(data, "s2").every((day) => !noteText(day, "还车")));
    assert.ok(at(data, "s3").every((day) => day.car));
    assert.ok(noteText(at(data, "s3").at(-1), "还车"));
    assert.match(reviewRoute(library, route).map((note) => note.text).join("\n"), /Twizel → 皇后镇：参考路线没走过这段，按接着开车算了用车天数/);
    assert.equal(estimateOwnBudget(library, data, { adults: 2, rooms: 1, cars: 1 }).counts.carDays, 5);
  });

  it("a place of the visitor's own between two drives keeps the car too", () => {
    const own = { placeId: "", name: "Dunedin", country: "nz" };
    const data = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 2], [own, 1], ["Te Anau", 2])));
    assert.ok(data.days.filter((day) => day.stopKey !== "s1" && day.stopKey !== "home").every((day) => day.car));
    assert.equal(data.days.filter((day) => noteText(day, "还车")).length, 1);
  });

  it("far apart, across the strait or the continent, is not taken as a drive", () => {
    assert.equal(hop(library, { placeId: id("Twizel") }, { placeId: id("奥克兰") }).drivable, undefined);
    assert.equal(hop(library, { placeId: id("Apollo Bay") }, { placeId: id("凯恩斯") }).drivable, undefined);
    assert.equal(hop(library, { placeId: id("基督城") }, { placeId: id("Te Anau") }).drivable, true);
  });

  it("a place of the visitor's own does not carry the car across a strait, a continent or outside our countries", () => {
    const own = (name, country) => ({ placeId: "", name, country });
    const cases = [
      stops(["皇后镇", 2], [own("Dunedin", "nz"), 1], ["奥克兰", 2]),
      stops(["基督城", 2], [own("Rotorua", "nz"), 2]),
      stops(["凯恩斯", 2], [own("Perth", "au"), 2], ["墨尔本", 2]),
      stops([own("Fiji", "other"), 3], [own("Bali", "other"), 3]),
      stops([own("Somewhere", ""), 2], [own("Elsewhere", ""), 2]),
    ];
    for (const route of cases) {
      assert.deepEqual(carChains(library, route), [], JSON.stringify(route.map((stop) => stop.name || stop.placeId)));
      const data = composePlan(library, sources, settings(route));
      assert.ok(data.days.every((day) => day.transport !== "自驾 · 车程自己查"));
      assert.doesNotMatch(reviewRoute(library, route).map((note) => note.text).join("\n"), /按接着开车算了用车天数/);
    }
    // Waitomo from Auckland is a tour day: no car and no car return after a flight in.
    const north = composePlan(library, sources, settings(cases[0]));
    assert.ok(at(north, "s3").every((day) => !day.car && !noteText(day, "还车")));
    // Without the whole route, a place of the visitor's own stays unknown.
    assert.equal(hop(library, { placeId: id("基督城") }, own("Dunedin", "nz")).drivable, undefined);
  });

  it("a day we drove around a place needs a car even when the visitor flew in", () => {
    const data = composePlan(library, sources, settings(stops(["悉尼", 3], ["皇后镇", 2], ["奥克兰", 2])));
    const glenorchy = data.days.find((day) => day.from === "nz:d13");
    assert.equal(glenorchy.car, true);
    assert.ok(noteText(glenorchy, "取车"));
    const budget = estimateOwnBudget(library, data, { adults: 2, rooms: 1, cars: 1 });
    assert.equal(budget.counts.carDays, 1);
    assert.ok(line(budget, "car").amounts.CNY > 0);
    const titles = ownTimeline(library, data).map((item) => item.title).join("|");
    assert.match(titles, /订租车/);
    assert.match(titles, /驾照/);
  });

  it("starting where we only returned the car still says where the car comes from", () => {
    const data = composePlan(library, sources, settings(stops(["皇后镇", 2], ["Te Anau", 2], ["Wānaka", 2])));
    const first = at(data, "s1");
    assert.ok(first.some((day) => day.car), "the Glenorchy day has the car");
    assert.ok(first.some((day) => noteText(day, "取车")));
  });

  it("the New Zealand preset still drives 9 days", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz")));
    assert.equal(estimateOwnBudget(library, data, { adults: 2, rooms: 1, cars: 1 }).counts.carDays, 9);
  });
});

describe("removing a stop's last day", () => {
  it("takes the stop out of the route, the stages, the title line and the map", () => {
    const data = composePlan(library, sources, settings(stops(["悉尼", 1], ["墨尔本", 1])));
    const gone = at(data, "s1")[0];
    const after = removeDay(data, gone.id);
    assert.deepEqual(after.plan.stops.map((stop) => stop.key), ["s2"]);
    assert.deepEqual(after.stages.map((stage) => stage.id), ["stage-s2"]);
    assert.doesNotMatch(after.trip.subtitle, /悉尼/);
    assert.doesNotMatch(after.trip.route, /悉尼/);
    assert.deepEqual(mapStops(library, after).map((stop) => stop.id), ["s2"]);
    assert.deepEqual(after.lodgings.map((stay) => stay.stopKey), ["s2"]);
    // Laying out the route again from the plan does not bring the stop back.
    assert.deepEqual(startRoute(null, after.plan, ROUTE_EMPTY).stops.map((stop) => stop.key), ["s2"]);
    // A stop with days left keeps its place, with the nights it has now.
    const longer = composePlan(library, sources, settings(stops(["悉尼", 2], ["墨尔本", 1])));
    const shorter = removeDay(longer, at(longer, "s1")[0].id);
    assert.deepEqual(shorter.plan.stops.map((stop) => [stop.key, stop.nights]), [["s1", 1], ["s2", 1]]);
    assert.match(shorter.trip.subtitle, /悉尼/);
  });
});

describe("what a borrowed day leaves behind", () => {
  // Every text a page shows for a day (not ids or links).
  // What to do "取车时" (at any pick-up) and a tram that "收车" (stops for the night) are left out: they may stay.
  const shown = (day) => JSON.stringify(day, (key, value) => (/^(id|url|from|dayId|stopKey)$/.test(key) ? undefined : value)).replace(/[取还]车时(?!间)|电车[^，；。,;]*收车/g, "");
  // Our pick-up and return, and the rental desks (what the rental let us drive, such as a gravel road, may stay).
  const ourLease = /还车|取车|收车|取还|ACE\s?\S*店|Sixt|50 Grant Road|166 Orchard Road/;

  it("no pick-up or return of our rental on a day borrowed into a plan without that car", () => {
    const data = composePlan(library, sources, settings(stops(["皇后镇", 1], ["奥克兰", 1])));
    const auckland = data.days.find((day) => day.from === "nz:d14");
    assert.ok(auckland, "the Auckland arrival is our day");
    assert.doesNotMatch(shown(auckland), ourLease);
    assert.equal(auckland.drive, null, "the drive to the rental desk is gone");
    assert.ok(!auckland.primaryResource, "and its map link");
    assert.ok(auckland.blocks.some((block) => /Auckland/.test(block.place)), "the rest of the day stays");
    assert.ok(data.days.every((day) => !day.car));
  });

  it("every borrowed day of both presets: our rental is gone, the plan's own pick-up and return stay", () => {
    for (const preset of ["nz", "au2026"]) {
      const data = composePlan(library, sources, settings(presetStops(library, preset)));
      for (const day of data.days.filter((item) => item.from)) {
        const { notes, ...rest } = day;
        assert.doesNotMatch(shown(rest), ourLease, `${preset} ${day.from}`);
        for (const note of notes || []) if (!/^(取车|还车)$/.test(note.label)) assert.doesNotMatch(shown(note.text), ourLease, `${preset} ${day.from} ${note.label}`);
      }
      assert.ok(data.days.some((day) => noteText(day, "取车")), `${preset}: the plan says where to pick the car up`);
    }
    // A drive that starts at the rental desk keeps its road, from the town the day starts in.
    const nzPlan = composePlan(library, sources, settings(presetStops(library, "nz")));
    const twizel = nzPlan.days.find((day) => day.from === "nz:d5");
    assert.match(twizel.drive.title, /Christchurch → Twizel/);
    assert.ok(twizel.drive.legs.length >= 5);
    // A day we rented a car for the day: the plan says to rent one for that day.
    const cairns = composePlan(library, sources, settings(stops(["凯恩斯", 4])));
    const tableland = cairns.days.find((day) => day.from === "au:d9");
    assert.ok(tableland?.car);
    assert.ok(cairns.days.some((day) => /当天取、当天还/.test(noteText(day, "取车"))));
  });

  it("no weather or clothes of our season on the visitor's days", () => {
    for (const preset of ["nz", "au2026"]) {
      const data = composePlan(library, sources, settings(presetStops(library, preset)));
      for (const day of data.days) {
        assert.equal(day.climateNote, "", day.title);
        assert.equal(day.clothingNote, "", day.title);
      }
      // None of our own weather or clothes lines reaches the text export either.
      const text = tripToMarkdown(data, { library });
      const ours = Object.values(sources).flatMap((trip) => trip.days.flatMap((day) => [day.climateNote, day.clothingNote])).filter((value) => value && value.length > 8);
      for (const value of ours) assert.ok(!text.includes(value), value);
    }
  });

  it("one place to sleep per stop, and our own way home is not the visitor's", () => {
    const data = composePlan(library, sources, settings(stops(["悉尼", 6])));
    const names = new Set(at(data, "s1").map((day) => day.lodging));
    assert.equal(names.size, 1);
    assert.equal(data.lodgings[0].name, [...names][0]);
    const home = data.days.at(-1);
    assert.equal(home.stopKey, "home");
    assert.equal(home.city, "悉尼 → 回国");
    assert.equal(home.base, "");
  });

  it("a stay from our other trip does not carry the place's note about a different hotel", () => {
    const data = composePlan(library, sources, settings(stops(["凯恩斯", 2], ["悉尼", 3])));
    const sydney = data.lodgings[1];
    const place = library.places.find((item) => item.id === id("悉尼"));
    assert.ok(!sydney.detail || place.lodging.note.includes(sydney.name));
  });

  it("a flight the other way round does not borrow our note for the other direction", () => {
    const route = stops(["奥克兰", 2], ["皇后镇", 2], ["基督城", 1], ["悉尼", 2]);
    const data = composePlan(library, sources, settings(route));
    const flights = data.days.filter((day) => /^从.+飞/.test(day.title));
    assert.equal(flights.length, 3);
    for (const day of flights) assert.doesNotMatch(noteText(day, "航班"), /飞奥克兰|到基督城/);
    assert.match(reviewRoute(library, route).map((note) => note.text).join("\n"), /奥克兰 → 皇后镇：参考路线是反方向飞的/);
  });
});

describe("routes that need a fallback", () => {
  it("the same place twice in a row is one stop", () => {
    const route = stops(["悉尼", 2], ["悉尼", 2], ["Twizel", 1], ["Twizel", 1]);
    assert.deepEqual(mergeRepeats(route).map((stop) => stop.nights), [4, 2]);
    const data = composePlan(library, sources, settings(route));
    assert.equal(data.plan.stops.length, 2);
    assert.ok(!data.days.some((day) => /从悉尼飞悉尼|从Twizel到Twizel/.test(day.title)));
    const text = reviewRoute(library, route).map((note) => note.text).join("\n");
    assert.match(text, /连着两站都是悉尼：生成时合成一站，一共住 4 晚/);
    assert.doesNotMatch(text, /悉尼 → 悉尼|都只住一晚/);
  });

  it("a first or last stop without international flights is not flown into or out of", () => {
    const data = composePlan(library, sources, settings(stops(["Twizel", 2], ["Wānaka", 1])));
    assert.doesNotMatch(data.days[0].title, /飞抵/);
    assert.doesNotMatch(JSON.stringify(data.days[0].blocks), /Twizel机场/);
    assert.match(noteText(data.days[0], "怎么去"), /没有国际航班/);
    assert.doesNotMatch(JSON.stringify(data.days.at(-1).blocks), /Wānaka机场/);
    assert.match(JSON.stringify(data.days.at(-1).blocks), /没有国际航班/);
  });

  it("spare days at a stop share out our ideas instead of repeating them", () => {
    const data = composePlan(library, sources, settings(stops(["基督城", 3])));
    const spare = at(data, "s1").filter((day) => day.title.startsWith("在基督城多留"));
    assert.equal(spare.length, 2);
    assert.notDeepEqual(spare[0].blocks.map((block) => block.activity), spare[1].blocks.map((block) => block.activity));
  });
});

describe("the budget", () => {
  const party = { adults: 2, rooms: 1, cars: 1 };

  it("no zero lines for a car nobody rents", () => {
    for (const route of [stops(["奥克兰", 4]), stops(["悉尼", 3])]) {
      const budget = estimateOwnBudget(library, composePlan(library, sources, settings(route)), party);
      assert.equal(line(budget, "car"), undefined);
      assert.equal(line(budget, "insurance"), undefined);
    }
  });

  it("a place outside both countries is priced at the average stay and leaves flights to fill in", () => {
    const other = { placeId: "", name: "Suva", country: "other" };
    const mixed = estimateOwnBudget(library, composePlan(library, sources, settings(stops(["悉尼", 2], [other, 4]))), party);
    const average = library.countries.au.rates.lodging.amounts.CNY;
    const sydney = library.places.find((place) => place.id === id("悉尼")).lodging.amounts.CNY;
    assert.equal(line(mixed, "lodging").amounts.CNY, sydney * 2 + average * 4);
    assert.match(line(mixed, "activity").note, /没去过的地方/);
    const alone = estimateOwnBudget(library, composePlan(library, sources, settings(stops([other, 4]))), party);
    assert.equal(line(alone, "lodging").amounts.CNY, average * 4);
    assert.deepEqual(line(alone, "flight").amounts, { CNY: 0 });
    assert.match(line(alone, "flight").note, /没有估价/);
    assert.equal(line(alone, "activity"), undefined);
  });
});

describe("editing days", () => {
  it("steps put back after the slower pace land where they stood, in any order", () => {
    const data = composePlan(library, sources, settings(presetStops(library, "nz"), { pace: "easy" }));
    for (const day of data.days.filter((item) => item.parked?.length >= 2)) {
      // Our day's steps, less the pick-up and return of our own rental (see withoutLease).
      const original = sources.nz.days.find((ours) => `nz:${ours.id}` === day.from).blocks
        .filter((block) => block.period !== MEAL_PERIOD && !/取车|还车|收车/.test(block.highlight || ""))
        .map((block) => withoutLease(block.activity))
        .filter(Boolean);
      for (const order of [day.parked, [...day.parked].reverse()]) {
        let next = data;
        for (const block of order) next = restoreParked(next, day.id, block.id);
        const timeline = next.days.find((item) => item.id === day.id).blocks.filter((block) => block.period !== MEAL_PERIOD).map((block) => block.activity);
        assert.deepEqual(timeline, original, day.from);
      }
    }
  });

  it("a day moves only within its own stop", () => {
    const data = composePlan(library, sources, settings(stops(["基督城", 1], ["Twizel", 2], ["Wānaka", 2])));
    const [first, second] = at(data, "s2");
    assert.equal(canMoveDay(data, first.id, 1), true);
    assert.equal(canMoveDay(data, second.id, 1), false);
    assert.equal(canMoveDay(data, first.id, -1), false);
    assert.equal(moveDay(data, second.id, 1), data);
    assert.equal(canMoveDay(data, data.days.at(-1).id, -1), false, "the day home stays last");
  });

  it("the 2026 route starts at D0 and keeps its own way of writing day labels and dates", () => {
    assert.equal(dayNumber(au2026.days[0]), "0");
    const added = addDay(au2026, "d5");
    assert.deepEqual(added.days.slice(0, 3).map((day) => day.label), ["D0", "D1", "D2"]);
    assert.equal(dayNumber(added.days[0]), "0");
    assert.equal(added.days[1].date, au2026.days[1].date, "landing in Melbourne keeps its date");
    assert.equal(added.days.find((day) => !day.date)?.title, "新的一天");
    const moved = moveDay(au2026, "d3", 1);
    const dates = moved.days.map((day) => day.date);
    assert.deepEqual(dates, [...dates].sort(), "dates still run forward");
    assert.equal(moved.days[3].id, "d4");
    assert.equal(moved.days[3].date, au2026.days[3].date);
  });

  it("a plan's day numbers keep starting at 1 with two digits", () => {
    const data = composePlan(library, sources, settings(stops(["悉尼", 2])));
    assert.deepEqual(data.days.map((day) => day.label), ["D01", "D02", "D03"]);
    assert.equal(data.days[0].date, "2030-03-04");
    assert.equal(data.days.at(-1).date, addDays("2030-03-04", 2));
  });
});
