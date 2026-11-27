// What the visitor saves on this device and opens from files: which route it belongs to, what is checked
// before a page uses it, and what happens when two tabs change it at once.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { composePlan, presetStops } from "../src/lib/compose.js";
import { copyStore, openWithSide, replay } from "../src/lib/copyStore.js";
import { isDate } from "../src/lib/dates.js";
import { addDay, addNote, exportFile, moveDay, noteIdAt, readCopy, readImport, removeDay, removeNote, renumberDays, saveCopy, storageKey, updateBlock, updateDay, updateNote } from "../src/lib/edits.js";
import { tripToMarkdown } from "../src/lib/markdown.js";
import { savedAsFile, savedFiles } from "../src/lib/recover.js";
import { needsConfirm, startRoute } from "../src/lib/routeDraft.js";
import { adoptLeftover, checksKey, prepKey, readChecks, readPrep, setCheck, changePrep, writeChecks, writeOpenedSide, writePrep } from "../src/lib/sideStore.js";
import { lightRows, todayOf } from "../src/lib/tripDays.js";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const library = read("data/places.json");
const nz = read("data/nz.json");
const au2026 = read("data/au2026.json");
const sources = { nz, au2026 };
const settings = (stops, patch = {}) => ({ stops, startDate: "2030-03-04", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours", ...patch });
const EMPTY = { stops: [], startDate: "", adults: 2, children: 0, rooms: 1, cars: 1, pace: "ours" };

function memoryStorage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

describe("a saved copy keeps the route it was saved for", () => {
  // The 2026 route with every dated day removed and one new day left: nothing inside says "2026" any more.
  const undated = () => {
    let data = addDay(au2026, au2026.days[0].id);
    for (const day of au2026.days) data = removeDay(data, day.id);
    assert.equal(data.days.length, 1);
    assert.ok(!data.days.some((day) => isDate(day.date)));
    return data;
  };

  it("opens again on its own page after a reload", () => {
    const storage = memoryStorage();
    saveCopy(storage, "au2026", undated(), au2026.version);
    const { copy, problem } = readCopy(storage, "au2026");
    assert.equal(problem, false);
    assert.equal(copy.data.days.length, 1);
  });

  it("an exported file opens on the page that saved it", () => {
    const opened = readImport(exportFile(undated(), "au2026"), "au2026");
    assert.equal(opened.data.days.length, 1);
    assert.throws(() => readImport(exportFile(undated(), "au2026"), "nz"), /澳洲参考路线/);
  });

  it("an older copy without the route mark is still placed by what is inside", () => {
    const storage = memoryStorage();
    storage.setItem(storageKey("au2026"), JSON.stringify({ trip: "au2026", baseVersion: "", data: nz }));
    assert.equal(readCopy(storage, "au2026").problem, true);
    assert.throws(() => readImport(JSON.stringify({ format: "trip-share", trip: "au2026", data: nz }), "au2026"), /新西兰参考路线/);
  });

  it("the file the error page saves carries the mark too, and opens on the same page", () => {
    const storage = memoryStorage();
    saveCopy(storage, "au2026", undated(), au2026.version);
    const file = savedAsFile(storage, "/au2026/days");
    assert.equal(JSON.parse(file).v, 2);
    assert.equal(readImport(file, "au2026").data.days.length, 1);
    assert.throws(() => readImport(file, "nz"), /澳洲参考路线/);
  });

  it("a marked file whose mark does not fit what is inside is refused, not placed by guessing", () => {
    const forged = (trip, data) => JSON.stringify({ format: "trip-share", v: 2, trip, data });
    const plan = composePlan(library, sources, settings(presetStops(library, "nz")));
    for (const [trip, data, page] of [["mine", nz, "nz"], ["nz", plan, "mine"], ["au2026", plan, "mine"]]) {
      assert.throws(() => readImport(forged(trip, data), page), (error) => /对不上/.test(error.message) && !error.page, `${trip} holding ${page}`);
      assert.throws(() => readImport(forged(trip, data)), /对不上/);
    }
    // A stored copy marked the same way does not show either.
    const storage = memoryStorage();
    storage.setItem(storageKey("mine"), JSON.stringify({ v: 2, trip: "mine", baseVersion: "", data: nz }));
    assert.equal(readCopy(storage, "mine").problem, true);
  });

  it("a route draft opened as a trip file points to /plan", () => {
    const draft = JSON.stringify({ format: "trip-share-route", route: { stops: [{ key: "a", placeId: "x", nights: 2 }] } });
    assert.throws(() => readImport(draft, "mine"), (error) => error.page?.href === "/plan");
  });
});

describe("a file changed by hand is checked before a page uses it", () => {
  const plan = () => composePlan(library, sources, settings(presetStops(library, "nz")));

  it("dates must be real calendar days written as text", () => {
    assert.equal(isDate(["2030-05-04"]), false);
    assert.equal(isDate("2030-04-31"), false);
    assert.equal(isDate("2030-04-30"), true);
    const bad = plan();
    bad.days[0].date = ["2030-05-04"];
    bad.days[1].date = "2030-04-31";
    const opened = readImport(exportFile(bad, "mine"), "mine").data;
    assert.equal(opened.days[0].date, undefined);
    assert.equal(opened.days[1].date, undefined);
    assert.doesNotThrow(() => lightRows(library, opened));
  });

  it("countries and time zones must be ones the site knows", () => {
    const own = composePlan(library, sources, settings([{ key: "a", placeId: "", name: "X", country: "nz", nights: 2 }]));
    own.plan.stops[0].country = "constructor";
    own.plan.stops[0].tz = "Mars/Olympus";
    for (const day of own.days) day.country = "toString";
    const opened = readImport(exportFile(own, "mine"), "mine").data;
    assert.equal(opened.plan.stops[0].country, "");
    assert.equal(opened.plan.stops[0].tz, undefined);
    assert.ok(opened.days.every((day) => day.country === ""));
    assert.doesNotThrow(() => todayOf(library, opened, new Date("2030-03-04T01:00:00Z"), "UTC"));
    // Even data that skipped the checks does not reach the clock with a function for a time zone.
    assert.doesNotThrow(() => todayOf(library, own, new Date("2030-03-04T01:00:00Z"), "UTC"));
  });
});

describe("a file with text fields taken out still opens and can be changed", () => {
  const made = composePlan(library, sources, settings(presetStops(library, "nz")));
  const run = (data) => {
    let next = addDay(data, data.days[0].id);
    next = removeDay(next, next.days[1].id);
    next = moveDay(next, next.days[2].id, 1);
    next = renumberDays({ ...next, plan: { ...next.plan, startDate: "2030-05-06" } });
    next = updateDay(next, next.days[0].id, { title: "改" });
    tripToMarkdown(next, { library });
    return next;
  };

  it("a stage without its title (the case that stopped every date and day change)", () => {
    const file = JSON.parse(exportFile(made, "mine"));
    delete file.data.stages[0].title;
    const { data } = readImport(JSON.stringify(file), "mine");
    assert.equal(data.stages[0].title, "");
    const next = run(data);
    assert.equal(next.days[0].date, "2030-05-06");
  });

  it("any one text field of the trip, a stage or a day taken out", () => {
    const fields = [
      ...Object.keys(made.trip).map((key) => ["trip", key]),
      ...Object.keys(made.stages[0]).filter((key) => key !== "id").map((key) => ["stage", key]),
      ...Object.keys(made.days[0]).filter((key) => key !== "id" && typeof made.days[0][key] === "string").map((key) => ["day", key]),
    ];
    for (const [where, key] of fields) {
      const file = JSON.parse(exportFile(made, "mine"));
      if (where === "trip") delete file.data.trip[key];
      if (where === "stage") for (const stage of file.data.stages) delete stage[key];
      if (where === "day") for (const day of file.data.days) delete day[key];
      const { data } = readImport(JSON.stringify(file), "mine");
      assert.doesNotThrow(() => run(data), `${where}.${key}`);
    }
  });
});

describe("an empty copy left by an older site version", () => {
  const leftover = (tripId) => JSON.stringify({ trip: tripId, data: { trip: { title: "x" }, days: [], prep: { added: [{ id: "mine-1", title: "换外币" }], hidden: ["x"] }, plan: { budget: { food: { CNY: 900 } } } } });

  it("hands its checklist and budget on instead of counting as nothing", () => {
    const storage = memoryStorage();
    storage.setItem(storageKey("mine"), leftover("mine"));
    const result = readCopy(storage, "mine");
    assert.equal(result.copy, null);
    assert.equal(result.problem, false);
    assert.deepEqual(result.leftover.prep.added.map((item) => item.title), ["换外币"]);
    assert.deepEqual(result.leftover.plan.budget, { food: { CNY: 900 } });
  });

  it("on a reference route its checklist moves next to the route before anything can write over it", () => {
    const storage = memoryStorage();
    storage.setItem(storageKey("nz"), leftover("nz"));
    assert.deepEqual(readPrep(storage, "nz").added.map((item) => item.title), ["换外币"]);
    adoptLeftover(storage, "nz");
    assert.deepEqual(JSON.parse(storage.getItem(prepKey("nz"))).added.map((item) => item.title), ["换外币"]);
    // Once moved, the route's own checklist is what counts.
    changePrep(storage, "nz", (prep) => ({ ...prep, added: [] }));
    assert.deepEqual(readPrep(storage, "nz").added, []);
  });

  it("joins the checklist kept next to the route when there already is one, once", () => {
    const storage = memoryStorage();
    storage.setItem(storageKey("nz"), leftover("nz"));
    writePrep(storage, "nz", { added: [{ id: "m2", title: "订车" }], hidden: ["y"] });
    adoptLeftover(storage, "nz");
    assert.deepEqual(readPrep(storage, "nz").added.map((item) => item.title).sort(), ["换外币", "订车"]);
    assert.deepEqual(readPrep(storage, "nz").hidden.sort(), ["x", "y"]);
    // A route saved over the empty copy afterwards keeps both.
    saveCopy(storage, "nz", updateDay(nz, "d1", { title: "改" }), nz.version);
    assert.deepEqual(readPrep(storage, "nz").added.map((item) => item.title).sort(), ["换外币", "订车"]);
    // Moved once: removing one of its items afterwards is not undone by the next page load.
    const storage2 = memoryStorage();
    storage2.setItem(storageKey("nz"), leftover("nz"));
    writePrep(storage2, "nz", { added: [{ id: "m2", title: "订车" }], hidden: [] });
    adoptLeftover(storage2, "nz");
    changePrep(storage2, "nz", (prep) => ({ ...prep, added: prep.added.filter((item) => item.title !== "换外币") }));
    adoptLeftover(storage2, "nz");
    assert.deepEqual(readPrep(storage2, "nz").added.map((item) => item.title), ["订车"]);
  });
});

describe("the page shown when /plan fails", () => {
  it("keeps the route draft as a file too, and a damaged draft does not stop /plan", () => {
    const storage = memoryStorage();
    const draft = { stops: [{ key: "a", placeId: "", name: "X", country: "nz", nights: 2 }], basis: { stops: { a: 1 } } };
    storage.setItem("trip-share:mine:route", JSON.stringify(draft));
    const files = savedFiles(storage, "/plan");
    assert.deepEqual(files.map((file) => file.key), ["trip-share:mine:route"]);
    assert.ok(JSON.parse(files[0].text).route.stops.length === 1);
    assert.doesNotThrow(() => startRoute(draft, { stops: [], startDate: "" }, EMPTY));
    saveCopy(storage, "mine", composePlan(library, sources, settings(presetStops(library, "nz"))), "mine");
    assert.deepEqual(savedFiles(storage, "/plan").map((file) => file.key), ["trip-share:mine:route", "trip-share:mine:v1"]);
  });
});

describe("two tabs of /plan", () => {
  it("asks again when the plan changed after this tab looked", () => {
    const storage = memoryStorage();
    // Both tabs opened with no plan; the first one makes one.
    assert.equal(needsConfirm(storage, ""), "");
    saveCopy(storage, "mine", composePlan(library, sources, settings(presetStops(library, "nz"))), "mine");
    const asked = needsConfirm(storage, "");
    assert.ok(asked, "the second tab asks before replacing the first tab's plan");
    assert.equal(needsConfirm(storage, asked), "", "the confirmed version can be replaced");
    saveCopy(storage, "mine", composePlan(library, sources, settings(presetStops(library, "au2026"))), "mine", new Date(Date.now() + 1000));
    assert.ok(needsConfirm(storage, asked), "a newer plan than the one confirmed asks again");
  });
});

describe("replaying edits made in another tab", () => {
  const withNotes = () => updateDay(nz, "d1", { notes: [{ label: "A", text: "a" }, { label: "B", text: "b" }, { label: "C", text: "c" }] });

  it("changes the same reminder, not the one now at its old position", () => {
    const base = withNotes();
    const day = base.days.find((item) => item.id === "d1");
    const idB = noteIdAt(day, 1);
    const other = removeNote(base, "d1", noteIdAt(day, 0));
    const again = replay({ baseVersion: "v", data: other }, [(data) => updateNote(data, "d1", idB, { text: "B 改过" })]);
    assert.deepEqual(again.data.days.find((item) => item.id === "d1").notes.map((note) => note.text), ["B 改过", "c"]);
  });

  it("says it could not redo an edit whose target is gone", () => {
    const base = withNotes();
    const day = base.days.find((item) => item.id === "d1");
    const idA = noteIdAt(day, 0);
    const other = removeNote(base, "d1", idA);
    assert.equal(replay({ baseVersion: "v", data: other }, [(data) => updateNote(data, "d1", idA, { text: "x" })]), null);
    const gone = removeDay(nz, "d2");
    assert.equal(replay({ baseVersion: "v", data: gone }, [(data) => updateBlock(data, "d2", nz.days[1].blocks[0].id, { place: "x" })]), null);
  });

  it("does not redo an edit made on a plan that was made again since, even with the same stops", () => {
    const sydney = library.places.find((place) => place.name.startsWith("悉尼")).id;
    const melbourne = library.places.find((place) => place.name.startsWith("墨尔本")).id;
    const first = composePlan(library, sources, settings([{ key: "s1", placeId: sydney, nights: 1 }, { key: "s2", placeId: melbourne, nights: 1 }]));
    const second = composePlan(library, sources, settings([{ key: "s2", placeId: melbourne, nights: 1 }, { key: "s1", placeId: sydney, nights: 1 }]));
    assert.notEqual(first.plan.generation, second.plan.generation);
    // Every reminder of a plan has its own id from the start, and no id is shared with the other plan.
    const ids = (data) => data.days.flatMap((day) => (day.notes || []).map((note) => note.id));
    assert.ok(ids(first).length > 0 && ids(first).every(Boolean));
    assert.equal(new Set(ids(first)).size, ids(first).length);
    assert.ok(!ids(first).some((noteId) => ids(second).includes(noteId)));
    const day = first.days.find((item) => item.notes?.length);
    const change = (data) => updateNote(data, day.id, noteIdAt(day, 0), { text: "旧方案里改的" });
    assert.equal(replay({ baseVersion: "mine", data: second }, [change], first.plan.generation), null);
    // On the same plan the edit is done again.
    const again = replay({ baseVersion: "mine", data: updateDay(first, first.days[0].id, { title: "另一页" }) }, [change], first.plan.generation);
    assert.equal(again.data.days.find((item) => item.id === day.id).notes[0].text, "旧方案里改的");
  });

  it("a new reminder gets an id of its own", () => {
    const next = addNote(withNotes(), "d1");
    const ids = next.days.find((item) => item.id === "d1").notes.map((note) => note.id);
    assert.equal(new Set(ids).size, 4);
  });
});

describe("checklist ticks from two tabs", () => {
  it("each tab's tick is kept", () => {
    const storage = memoryStorage();
    setCheck(storage, "nz", "one", true);
    setCheck(storage, "nz", "two", true);
    assert.deepEqual(readChecks(storage, "nz"), { one: true, two: true });
    setCheck(storage, "nz", "one", false);
    assert.deepEqual(readChecks(storage, "nz"), { two: true });
  });

  it("each tab's checklist change is kept", () => {
    const storage = memoryStorage();
    changePrep(storage, "nz", (prep) => ({ ...prep, hidden: [...prep.hidden, "a"] }));
    changePrep(storage, "nz", (prep) => ({ ...prep, added: [...prep.added, { id: "m1", title: "t", detail: "" }] }));
    assert.deepEqual(readPrep(storage, "nz"), { added: [{ id: "m1", title: "t", detail: "" }], hidden: ["a"] });
  });
});

describe("opening a file replaces the route and its checklist together", () => {
  const sideKeys = [checksKey("nz"), prepKey("nz")];
  const writeSide = (storage) => {
    storage.setItem(checksKey("nz"), JSON.stringify({ fromFile: true }));
    storage.setItem(prepKey("nz"), JSON.stringify({ added: [{ id: "f", title: "文件" }], hidden: [] }));
  };

  it("leaves the checklist alone when another tab saved the route first", () => {
    const storage = memoryStorage();
    storage.setItem(checksKey("nz"), JSON.stringify({ mine: true }));
    const tab = copyStore(storage, "nz");
    tab.load();
    copyStore(storage, "nz").save({ baseVersion: "x", data: updateDay(nz, "d1", { title: "另一页" }) });
    const result = openWithSide(storage, tab, { baseVersion: "x", data: updateDay(nz, "d2", { title: "文件" }) }, sideKeys, writeSide);
    assert.equal(result.opened, false);
    assert.equal(result.conflict, true);
    assert.deepEqual(readChecks(storage, "nz"), { mine: true });
  });

  it("puts everything back when part of it cannot be written", () => {
    const storage = memoryStorage();
    storage.setItem(checksKey("nz"), JSON.stringify({ mine: true }));
    const tab = copyStore(storage, "nz");
    tab.load();
    const result = openWithSide(storage, tab, { baseVersion: "x", data: updateDay(nz, "d2", { title: "文件" }) }, sideKeys, () => {
      storage.setItem(checksKey("nz"), JSON.stringify({ half: true }));
      throw new Error("full");
    });
    assert.equal(result.opened, false);
    assert.equal(storage.getItem(storageKey("nz")), null);
    assert.deepEqual(readChecks(storage, "nz"), { mine: true });
    // The tab can still save afterwards: it has not lost track of what storage holds.
    assert.equal(tab.save({ baseVersion: "x", data: nz }).saved, true);
  });

  it("puts the old route back when the room just taken by the file is all that was left", () => {
    // Room for the old route and a little more: the file's smaller route and its ticks fit, its checklist
    // does not, and the old route only fits again once the file's ticks are gone too.
    const oldRoute = JSON.stringify({ v: 2, trip: "nz", baseVersion: "v", savedAt: "", data: updateDay(nz, "d1", { focus: "长".repeat(60000) }) });
    const limit = oldRoute.length + 15000;
    const map = new Map();
    const used = () => [...map].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
    const storage = {
      getItem: (key) => map.get(key) ?? null,
      removeItem: (key) => map.delete(key),
      setItem: (key, value) => {
        const old = map.get(key);
        map.set(key, String(value));
        if (used() > limit) {
          if (old === undefined) map.delete(key);
          else map.set(key, old);
          throw new Error("QuotaExceededError");
        }
      },
    };
    storage.setItem(storageKey("nz"), oldRoute);
    const tab = copyStore(storage, "nz");
    tab.load();
    const small = { ...nz, days: nz.days.slice(0, 2), stages: [] };
    const ticks = Object.fromEntries(Array.from({ length: 3000 }, (_, index) => [`c${index}`, true]));
    const result = openWithSide(storage, tab, { baseVersion: "v", data: small }, sideKeys, (target) => {
      target.setItem(checksKey("nz"), JSON.stringify(ticks));
      target.setItem(prepKey("nz"), JSON.stringify({ added: [{ id: "p", title: "x".repeat(oldRoute.length) }], hidden: [] }));
    });
    assert.equal(result.opened, false);
    assert.equal(result.restored, true, "the page may say nothing changed");
    assert.equal(storage.getItem(storageKey("nz")), oldRoute);
    assert.equal(storage.getItem(checksKey("nz")), null);
    assert.equal(storage.getItem(prepKey("nz")), null);
  });

  it("says so when storage could not be put back, and hands back what it holds now", () => {
    const storage = memoryStorage();
    storage.setItem(checksKey("nz"), JSON.stringify({ mine: true }));
    const tab = copyStore(storage, "nz");
    tab.load();
    const setItem = storage.setItem;
    let broken = false;
    storage.setItem = (key, value) => {
      if (broken) throw new Error("QuotaExceededError");
      setItem(key, value);
    };
    const result = openWithSide(storage, tab, { baseVersion: "x", data: updateDay(nz, "d2", { title: "文件" }) }, sideKeys, () => {
      broken = true;
      throw new Error("full");
    });
    assert.equal(result.opened, false);
    assert.equal(result.restored, false);
    assert.equal(result.current.copy, null, "what storage holds now: no copy");
  });

  it("writes both when nothing is in the way", () => {
    const storage = memoryStorage();
    const tab = copyStore(storage, "nz");
    tab.load();
    const result = openWithSide(storage, tab, { baseVersion: "x", data: updateDay(nz, "d2", { title: "文件" }) }, sideKeys, writeSide);
    assert.equal(result.opened, true);
    assert.equal(readCopy(storage, "nz").copy.data.days[1].title, "文件");
    assert.deepEqual(readChecks(storage, "nz"), { fromFile: true });
  });
});

describe("ticks after a file is opened", () => {
  it("on the visitor's plan a file without ticks leaves none, whichever button opened it", () => {
    const storage = memoryStorage();
    writeChecks(storage, "mine", { "book-flight": true });
    writeOpenedSide(storage, "mine", { checks: {}, prep: null });
    assert.deepEqual(readChecks(storage, "mine"), {});
    writeOpenedSide(storage, "mine", { checks: { visa: true }, prep: { added: [], hidden: ["x"] } });
    assert.deepEqual(readChecks(storage, "mine"), { visa: true });
    assert.equal(storage.getItem(prepKey("mine")), null, "a plan keeps its checklist inside itself");
  });

  it("on our routes the file's ticks join this device's and its checklist replaces the one here", () => {
    const storage = memoryStorage();
    writeChecks(storage, "nz", { mine: true });
    writePrep(storage, "nz", { added: [{ id: "a", title: "旧" }], hidden: [] });
    writeOpenedSide(storage, "nz", { checks: {}, prep: null });
    assert.deepEqual(readChecks(storage, "nz"), { mine: true });
    writeOpenedSide(storage, "nz", { checks: { file: true }, prep: { added: [{ id: "b", title: "文件" }], hidden: [] } });
    assert.deepEqual(readChecks(storage, "nz"), { mine: true, file: true });
    assert.deepEqual(readPrep(storage, "nz").added.map((item) => item.title), ["文件"]);
  });
});
