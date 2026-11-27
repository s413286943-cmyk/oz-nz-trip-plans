// A visitor's own copy of a trip: every change returns a new object, nothing is mutated.
// The copy lives in this browser's localStorage only.

import { addDays, isDate, weekdayOf } from "./dates.js";
import { monthDay } from "./format.js";
import { knownCountry, knownStopZone } from "./zones.js";

export const MEAL_PERIOD = "饮食";
export const OPTIONAL = /^可加/;

export function storageKey(tripId) {
  return `trip-share:${tripId}:v1`;
}

// Reads this browser's copy. Anything that would not render (broken JSON, a file of another route
// saved here by mistake, wrong field types) is left out, and the original shows instead.
export function loadCopy(storage, tripId) {
  return readCopy(storage, tripId).copy;
}

// Copies and files written by this version say which route they belong to (`trip`) and mark that with
// `v: 2`, so the route never has to be guessed from what is inside. Older ones are placed by their content.
const ROUTE_MARK = 2;

// The route a stored copy or a file was saved for: its own word when it carries the mark, else what is
// inside. A marked one whose word does not fit what is inside (a plan of the visitor's own labelled as a
// reference route, or the other way round, or a route this site does not have) is damaged: null.
function routeNamed(saved, data) {
  if (saved?.v !== ROUTE_MARK) return routeOf(data);
  const fits = KNOWN_ROUTES.includes(saved.trip) && (saved.trip === "mine") === Array.isArray(data?.plan?.stops);
  return fits ? saved.trip : null;
}

// Same as loadCopy, and says when something was stored but could not be used (`problem`).
// `leftover`: what an empty copy from an older site version still holds (see below), to be handed on.
export function readCopy(storage, tripId) {
  const raw = storage?.getItem(storageKey(tripId));
  if (!raw) return { copy: null, problem: false };
  try {
    const saved = JSON.parse(raw);
    // An older site version saved an empty plan (no days) when a checklist item was added before any plan
    // existed. There are no days in it to show, so it is not a broken copy; its checklist and budget are passed on.
    if (isPlain(saved?.data) && Array.isArray(saved.data.days) && !saved.data.days.length) {
      const leftover = leftoverOf(saved.data);
      return leftover ? { copy: null, problem: false, leftover } : { copy: null, problem: false };
    }
    const data = normalizeTrip(saved?.data);
    if (!data || (saved.trip && saved.trip !== tripId)) return { copy: null, problem: true };
    if (KNOWN_ROUTES.includes(tripId) && routeNamed(saved, data) !== tripId) return { copy: null, problem: true };
    return { copy: { baseVersion: String(saved.baseVersion || ""), savedAt: String(saved.savedAt || ""), data }, problem: false };
  } catch {
    return { copy: null, problem: true };
  }
}

// The checklist changes and budget amounts kept in an empty copy, or null when it holds none.
function leftoverOf(data) {
  const prep = isPlain(data.prep) ? cleanPrep(data.prep) : null;
  const budgetLines = isPlain(data.plan) && "budget" in data.plan ? budget(data.plan.budget) : {};
  const out = {
    ...(prep && (prep.added.length || prep.hidden.length) ? { prep } : {}),
    ...(Object.keys(budgetLines).length ? { plan: { budget: budgetLines } } : {}),
  };
  return Object.keys(out).length ? out : null;
}

export function saveCopy(storage, tripId, data, baseVersion, now = new Date()) {
  const savedAt = now.toISOString();
  storage.setItem(storageKey(tripId), JSON.stringify({ v: ROUTE_MARK, trip: tripId, baseVersion, savedAt, data }));
  return savedAt;
}

export function clearCopy(storage, tripId) {
  storage.removeItem(storageKey(tripId));
}

export function validTrip(data) {
  return normalizeTrip(data) !== null;
}

// The route a trip belongs to when nothing says so: the visitor's own plan has its route stops,
// the 2026 route has calendar dates, the New Zealand route has neither.
export function routeOf(data) {
  if (Array.isArray(data?.plan?.stops)) return "mine";
  return (data?.days || []).some((day) => isDate(day?.date)) ? "au2026" : "nz";
}

const KNOWN_ROUTES = ["nz", "au2026", "mine"];
export const ROUTE_HOME = {
  nz: { name: "新西兰参考路线", href: "/nz", label: "去新西兰参考路线" },
  au2026: { name: "澳洲参考路线", href: "/au2026/days", label: "去澳洲参考路线的改行程页" },
  mine: { name: "方案", href: "/mine", label: "去方案页" },
};

// A file meant for another page: the message says where it opens.
export class ImportError extends Error {
  constructor(message, page = null) {
    super(message);
    this.page = page;
  }
}

// Reads a file the visitor exported earlier. Throws a message meant for the visitor.
export function parseImport(text, tripId = "") {
  return readImport(text, tripId).data;
}

// The file's trip, the version of our route it was made from, and the checklist ticks saved with it.
export function readImport(text, tripId = "") {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("这个文件不是这个网站存的。");
  }
  if (parsed?.format === "trip-share-route") {
    throw new ImportError("这是排路线页存的草稿，要到排路线页打开。", { href: "/plan", label: "去排路线" });
  }
  const wrapped = parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object";
  const data = normalizeTrip(wrapped ? parsed.data : parsed);
  if (!data) throw new ImportError("文件里没有找到每天的行程。");
  const named = wrapped && typeof parsed.trip === "string" ? parsed.trip : "";
  if (named && !KNOWN_ROUTES.includes(named)) throw new ImportError("这个文件不是这个网站存的。");
  // A file from this version names its route. In an older one what is inside decides the page: an older
  // site version could label a file with the wrong route (the New Zealand route kept under the 2026 key),
  // and such a file must still open somewhere.
  const route = wrapped ? routeNamed(parsed, data) : routeOf(data);
  if (!route) throw new ImportError("这个文件写的路线和里面的内容对不上，可能被改坏了，打不开。");
  if (tripId && KNOWN_ROUTES.includes(tripId) && route !== tripId) {
    const home = ROUTE_HOME[route];
    throw new ImportError(`这是${home.name}存的文件，要到那一页打开。`, { href: home.href, label: home.label });
  }
  const extras = wrapped && parsed.extras && typeof parsed.extras === "object" ? parsed.extras : {};
  return {
    data,
    baseVersion: wrapped && typeof parsed.baseVersion === "string" ? parsed.baseVersion : "",
    checks: cleanChecks(extras.checks),
    prep: extras.prep ? cleanPrep(extras.prep) : null,
  };
}

export function exportFile(data, tripId, { baseVersion = "", checks = null, prep = null } = {}) {
  const extras = {
    ...(checks && Object.keys(checks).length ? { checks } : {}),
    ...(prep ? { prep } : {}),
  };
  return JSON.stringify({
    format: "trip-share",
    v: ROUTE_MARK,
    trip: tripId,
    exportedAt: new Date().toISOString(),
    ...(baseVersion ? { baseVersion } : {}),
    ...(Object.keys(extras).length ? { extras } : {}),
    data,
  }, null, 2);
}

// Checklist ticks: { itemId: true }.
export function cleanChecks(value) {
  if (!isPlain(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, done]) => done === true));
}

export function cleanPrep(value) {
  const prep = isPlain(value) ? value : {};
  return {
    added: (Array.isArray(prep.added) ? prep.added : [])
      .filter((item) => isPlain(item) && typeof item.id === "string" && item.id)
      .map((item) => ({ id: item.id, title: text(item.title) || "", detail: text(item.detail) || "" })),
    hidden: (Array.isArray(prep.hidden) ? prep.hidden : []).filter((id) => typeof id === "string"),
  };
}

const isPlain = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value) => (value === undefined || value === null ? value : typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "");
const list = (value) => (Array.isArray(value) ? value.filter(isPlain) : []);

const TRIP_TEXT = ["title", "subtitle", "dates", "travelers", "route", "summary", "statusNote", "coverImageUrl", "coverImageAlt"];
const DAY_TEXT = ["id", "label", "city", "base", "title", "focus", "lodging", "lodgingStatus", "climateNote", "clothingNote", "coverImageUrl", "coverImageAlt", "cityImageUrl", "transport", "leaveBy", "weekday", "stopKey", "country", "from"];
const BLOCK_TEXT = ["id", "dayId", "period", "place", "activity", "highlight", "tip", "choice", "miss"];
const STAGE_TEXT = ["id", "title", "summary", "imageUrl"];
const RESOURCE_TEXT = ["id", "title", "type", "url", "imageUrl", "imageAlt", "sourceNote"];
const DRIVE_TEXT = ["id", "dayId", "title", "duration", "sequence", "notes"];
const LEG_TEXT = ["segment", "driveTime", "stopNote", "time", "mode"];
const ADVICE_TEXT = ["title", "verdict", "detail", "action"];
const LODGING_TEXT = ["name", "title", "area", "room", "detail", "status", "afterDeadline", "stopKey"];
const TODO_TEXT = ["id", "kind", "dueDate", "dueLabel", "title", "detail"];
const DINING_TEXT = ["dayId", "meal", "time", "status", "bookingRef", "note"];
// Numbers the pages count with or print; anything else in their place is dropped.
const NUMBERS = ["sortOrder", "fromDay", "toDay", "lat", "lon", "driveHours", "origin"];

function texts(item, keys) {
  const out = { ...item };
  for (const key of keys) {
    if (key in out) out[key] = text(out[key]);
  }
  for (const key of NUMBERS) {
    if (key in out && !Number.isFinite(out[key])) delete out[key];
  }
  return out;
}

const resource = (value) => (isPlain(value) ? texts(value, RESOURCE_TEXT) : undefined);
const resources = (value) => list(value).map(resource);

function block(item) {
  return { ...texts(item, BLOCK_TEXT), resources: resources(item.resources) };
}

function advice(item) {
  return { ...texts(item, ADVICE_TEXT), dayIds: (Array.isArray(item.dayIds) ? item.dayIds : []).filter((id) => typeof id === "string"), resources: resources(item.resources) };
}

function lodging(item) {
  const out = texts(item, LODGING_TEXT);
  if (!isDate(out.checkIn)) {
    delete out.checkIn;
    delete out.checkOut;
  } else if (!isDate(out.checkOut)) delete out.checkOut;
  if ("resource" in out) {
    if (isPlain(out.resource)) out.resource = resource(out.resource);
    else delete out.resource;
  }
  return out;
}

function dining(item) {
  // The dining page cuts the place name, so it is always text.
  return { ...texts(item, DINING_TEXT), place: text(item.place) || "", resources: resources(item.resources) };
}

const ROWS = { lodgings: lodging, todos: (item) => texts(item, TODO_TEXT), dining };

function day(item) {
  const out = { ...texts(item, DAY_TEXT), blocks: list(item.blocks).map(block) };
  // The day's label and title are always written (the editor, the day numbers and the plan's outline read them).
  if (typeof out.label !== "string") out.label = "";
  if (typeof out.title !== "string") out.title = "";
  if ("notes" in item) {
    out.notes = list(item.notes).map(({ id, ...note }) => ({ ...note, ...(typeof id === "string" && id ? { id } : {}), label: text(note.label) || "", text: text(note.text) || "" }));
  }
  if ("country" in out) out.country = knownCountry(out.country);
  if ("parked" in item) out.parked = list(item.parked).map(block);
  if (!isDate(out.date)) {
    delete out.date;
    delete out.weekday;
  }
  if ("dayNumber" in out && !Number.isInteger(out.dayNumber)) delete out.dayNumber;
  for (const key of ["lodgingResource", "primaryResource", "ticketResource"]) {
    if (key in out && out[key] !== null) {
      if (isPlain(out[key])) out[key] = resource(out[key]);
      else delete out[key];
    }
  }
  if ("drive" in out && out.drive !== null) {
    out.drive = isPlain(out.drive)
      ? { ...texts(out.drive, DRIVE_TEXT), title: text(out.drive.title) || "", legs: list(out.drive.legs).map((leg) => texts(leg, LEG_TEXT)), resources: resources(out.drive.resources) }
      : null;
  }
  return out;
}

function plan(value) {
  const whole = (number, min, fallback) => (Number.isInteger(number) && number >= min ? number : fallback);
  return {
    ...value,
    startDate: isDate(value.startDate) ? value.startDate : "",
    adults: whole(value.adults, 1, 2),
    children: whole(value.children, 0, 0),
    rooms: whole(value.rooms, 1, 1),
    cars: whole(value.cars, 1, 1),
    ...(Array.isArray(value.stops) ? {
      stops: list(value.stops).map(({ tz, ...stop }) => ({
        ...stop,
        key: text(stop.key) || "",
        placeId: text(stop.placeId) || "",
        name: text(stop.name) || "",
        country: knownCountry(stop.country),
        nights: whole(stop.nights, 0, 1),
        ...(knownStopZone(tz) ? { tz } : {}),
      })),
    } : {}),
    ...("route" in value ? { route: text(value.route) || "" } : {}),
    ...("generation" in value ? { generation: typeof value.generation === "string" ? value.generation : "" } : {}),
    ...("pace" in value ? { pace: text(value.pace) || "" } : {}),
    ...("budget" in value ? { budget: budget(value.budget) } : {}),
    ...("leftOver" in value ? {
      leftOver: list(value.leftOver).map((item) => ({
        ...item,
        stopKey: text(item.stopKey) || "",
        titles: (Array.isArray(item.titles) ? item.titles : []).filter((title) => typeof title === "string"),
      })),
    } : {}),
  };
}

// The visitor's own budget lines: { kind: { currency: amount } }, amounts as numbers.
function budget(value) {
  if (!isPlain(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([, amounts]) => isPlain(amounts))
    .map(([kind, amounts]) => [kind, Object.fromEntries(Object.entries(amounts).filter(([, amount]) => Number.isFinite(amount)))]));
}

// Only pictures from this site and only web links: a file from someone else cannot point the page anywhere else.
const LOCAL_PATH = /^\/(?!\/)/;
const WEB_LINK = /^https?:\/\//i;

function safeLinks(value, key = "") {
  if (typeof value === "string") {
    if (/imageurl$/i.test(key)) return LOCAL_PATH.test(value) ? value : "";
    if (/^url$/i.test(key)) return WEB_LINK.test(value) || LOCAL_PATH.test(value) ? value : "";
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => safeLinks(item, key));
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, safeLinks(item, name)]));
  return value;
}

// A trip as the pages expect it, or null when there is nothing usable. Valid trips come back unchanged.
export function normalizeTrip(data) {
  if (!isPlain(data) || !isPlain(data.trip) || !Array.isArray(data.days)) return null;
  const seen = new Set();
  const days = data.days
    .filter((item) => isPlain(item) && typeof item.id === "string" && item.id && !seen.has(item.id) && seen.add(item.id))
    .map(day);
  if (!days.length) return null;
  const stageIds = new Set();
  const stages = list(data.stages)
    .filter((stage) => typeof stage.id === "string" && !stageIds.has(stage.id) && stageIds.add(stage.id))
    .map((stage) => ({ ...texts(stage, STAGE_TEXT), title: text(stage.title) || "", dayIds: (Array.isArray(stage.dayIds) ? stage.dayIds : []).filter((id) => seen.has(id)) }));
  const out = { ...data, trip: texts(data.trip, TRIP_TEXT), stages, days };
  if ("version" in data) out.version = text(data.version);
  for (const [key, row] of Object.entries(ROWS)) {
    if (key in data) out[key] = list(data[key]).map(row);
  }
  if ("advice" in data) out.advice = list(data.advice).map(advice);
  if ("plan" in data) {
    if (isPlain(data.plan)) out.plan = plan(data.plan);
    else delete out.plan;
  }
  if ("prep" in data) {
    if (isPlain(data.prep)) out.prep = cleanPrep(data.prep);
    else delete out.prep;
  }
  return safeLinks(out);
}

// An edit whose day, step or reminder is no longer there (another tab removed it): it is not done
// somewhere else instead, and the tab says the edit was not saved.
export class EditConflict extends Error {}

function mapDay(data, dayId, change) {
  if (!data.days.some((day) => day.id === dayId)) throw new EditConflict("day");
  return { ...data, days: data.days.map((day) => (day.id === dayId ? change(day) : day)) };
}

const needBlock = (blocks, blockId) => {
  if (!blocks.some((block) => block.id === blockId)) throw new EditConflict("step");
};

function renumber(blocks) {
  return blocks.map((block, index) => ({ ...block, sortOrder: (index + 1) * 10 }));
}

export function updateDay(data, dayId, patch) {
  return mapDay(data, dayId, (day) => ({ ...day, ...patch }));
}

export function updateBlock(data, dayId, blockId, patch) {
  return mapDay(data, dayId, (day) => {
    needBlock(day.blocks, blockId);
    return { ...day, blocks: day.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)) };
  });
}

let counter = 0;
function newBlockId(dayId) {
  counter += 1;
  return `${dayId}-mine-${Date.now().toString(36)}${counter}`;
}

// Adds an empty step after `afterId`, or at the end of the timeline (before the meals line).
export function addBlock(data, dayId, afterId = "") {
  return mapDay(data, dayId, (day) => {
    const timeline = day.blocks.filter((block) => block.period !== MEAL_PERIOD);
    const meals = day.blocks.filter((block) => block.period === MEAL_PERIOD);
    const block = {
      id: newBlockId(day.id),
      dayId: day.id,
      sortOrder: 0,
      period: "",
      place: "",
      activity: "",
      highlight: "",
      tip: "",
      choice: "",
      miss: "",
      resources: [],
    };
    const index = afterId ? timeline.findIndex((item) => item.id === afterId) : -1;
    if (afterId && index < 0) throw new EditConflict("step");
    const next = index >= 0 ? [...timeline.slice(0, index + 1), block, ...timeline.slice(index + 1)] : [...timeline, block];
    return { ...day, blocks: renumber([...next, ...meals]) };
  });
}

export function removeBlock(data, dayId, blockId) {
  return mapDay(data, dayId, (day) => {
    needBlock(day.blocks, blockId);
    return { ...day, blocks: renumber(day.blocks.filter((block) => block.id !== blockId)) };
  });
}

export function moveBlock(data, dayId, blockId, direction) {
  return mapDay(data, dayId, (day) => {
    const timeline = day.blocks.filter((block) => block.period !== MEAL_PERIOD);
    const meals = day.blocks.filter((block) => block.period === MEAL_PERIOD);
    const index = timeline.findIndex((block) => block.id === blockId);
    if (index < 0) throw new EditConflict("step");
    const target = index + direction;
    if (target < 0 || target >= timeline.length) return day;
    const next = [...timeline];
    [next[index], next[target]] = [next[target], next[index]];
    return { ...day, blocks: renumber([...next, ...meals]) };
  });
}

export function setMeals(data, dayId, text) {
  return mapDay(data, dayId, (day) => {
    const has = day.blocks.some((block) => block.period === MEAL_PERIOD);
    const blocks = has
      ? day.blocks.map((block) => (block.period === MEAL_PERIOD ? { ...block, activity: text } : block))
      : [...day.blocks, { id: newBlockId(day.id), dayId: day.id, sortOrder: 0, period: MEAL_PERIOD, place: "", activity: text, highlight: "", tip: "", choice: "", miss: "", resources: [] }];
    return { ...day, blocks: renumber(blocks) };
  });
}

// Reminders are found by id, never by position: an edit done again after another tab removed the reminder
// before it must not land on the one that moved up. Reminders from our routes and older copies have no id
// yet: each gets one from where it stands the first time its day's reminders are edited, and keeps it.
export function noteIdAt(day, index) {
  return withNoteIds(day.id, day.notes || [])[index]?.id;
}

function withNoteIds(dayId, notes) {
  if (notes.every((note) => typeof note.id === "string" && note.id)) {
    const ids = notes.map((note) => note.id);
    if (new Set(ids).size === ids.length) return notes;
  }
  const taken = new Set();
  return notes.map((note, index) => {
    let id = typeof note.id === "string" && note.id && !taken.has(note.id) ? note.id : `${dayId}-n${index + 1}`;
    for (let extra = 2; taken.has(id); extra += 1) id = `${dayId}-n${index + 1}-${extra}`;
    taken.add(id);
    return id === note.id ? note : { ...note, id };
  });
}

const notesOf = (day) => withNoteIds(day.id, day.notes || []);

export function updateNote(data, dayId, noteId, patch) {
  return mapDay(data, dayId, (day) => {
    const notes = notesOf(day);
    if (!notes.some((note) => note.id === noteId)) throw new EditConflict("note");
    return { ...day, notes: notes.map((note) => (note.id === noteId ? { ...note, ...patch, id: noteId } : note)) };
  });
}

let noteCounter = 0;

export function addNote(data, dayId) {
  noteCounter += 1;
  const id = `${dayId}-note-${Date.now().toString(36)}${noteCounter}`;
  return mapDay(data, dayId, (day) => ({ ...day, notes: [...notesOf(day), { id, label: "", text: "" }] }));
}

export function removeNote(data, dayId, noteId) {
  return mapDay(data, dayId, (day) => {
    const notes = notesOf(day);
    if (!notes.some((note) => note.id === noteId)) throw new EditConflict("note");
    return { ...day, notes: notes.filter((note) => note.id !== noteId) };
  });
}

export function updateTrip(data, patch) {
  return { ...data, trip: { ...data.trip, ...patch } };
}

// Steps set aside when the visitor chose the slower pace; this puts one back on the timeline.
export function restoreParked(data, dayId, blockId) {
  return mapDay(data, dayId, (day) => {
    const block = (day.parked || []).find((item) => item.id === blockId);
    if (!block) throw new EditConflict("step");
    const timeline = day.blocks.filter((item) => item.period !== MEAL_PERIOD);
    const meals = day.blocks.filter((item) => item.period === MEAL_PERIOD);
    // Back before the first step that stood after it (`origin`: its place before it was set aside).
    // Plans saved before steps remembered that fall back to the step numbers.
    const at = Number.isFinite(block.origin)
      ? timeline.findIndex((item) => Number.isFinite(item.origin) && item.origin > block.origin)
      : timeline.findIndex((item) => item.sortOrder > block.sortOrder);
    const next = at < 0 ? [...timeline, block] : [...timeline.slice(0, at), block, ...timeline.slice(at)];
    return { ...day, blocks: renumber([...next, ...meals]), parked: day.parked.filter((item) => item.id !== blockId) };
  });
}

let dayCounter = 0;

// A blank day right after `afterId`, staying where that day stays.
export function addDay(data, afterId) {
  const index = data.days.findIndex((day) => day.id === afterId);
  if (index < 0) return data;
  const after = data.days[index];
  dayCounter += 1;
  const id = `mine-${Date.now().toString(36)}${dayCounter}`;
  const day = {
    id,
    label: "",
    city: after.base || after.city || "",
    base: after.base || "",
    stopKey: after.stopKey,
    country: after.country,
    car: after.car,
    title: "新的一天",
    focus: "",
    lodging: after.lodging || "",
    lodgingResource: after.lodgingResource,
    lodgingStatus: after.lodgingStatus || "",
    climateNote: after.climateNote || "",
    clothingNote: after.clothingNote || "",
    coverImageUrl: after.cityImageUrl || after.coverImageUrl || "",
    coverImageAlt: "",
    cityImageUrl: after.cityImageUrl || "",
    transport: "",
    leaveBy: "",
    notes: [],
    blocks: [],
  };
  const days = [...data.days.slice(0, index + 1), day, ...data.days.slice(index + 1)];
  const stages = (data.stages || []).map((stage) => {
    const at = stage.dayIds.indexOf(afterId);
    return at < 0 ? stage : { ...stage, dayIds: [...stage.dayIds.slice(0, at + 1), id, ...stage.dayIds.slice(at + 1)] };
  });
  return renumberDays({ ...data, days, stages });
}

export function removeDay(data, dayId) {
  const gone = data.days.find((day) => day.id === dayId);
  if (!gone || data.days.length <= 1) return data;
  const days = data.days.filter((day) => day.id !== dayId);
  const stages = (data.stages || []).map((stage) => ({ ...stage, dayIds: stage.dayIds.filter((id) => id !== dayId) }));
  const dining = (data.dining || []).filter((row) => row.dayId !== dayId);
  const advice = (data.advice || [])
    .map((item) => ({ ...item, dayIds: (item.dayIds || []).filter((id) => id !== dayId) }))
    .filter((item, index) => item.dayIds.length || !(data.advice[index].dayIds || []).length);
  return renumberDays({ ...data, days, stages, dining, ...(data.advice ? { advice } : {}) }, [numberOf(gone)]);
}

// The part of the trip a day is shown in: its stage, or the days before and after all stages.
function groupOf(data, day) {
  return (data.stages || []).find((stage) => stage.dayIds.includes(day.id))?.id || "";
}

// A day moves within its own stage; across the border it would sit among the other stop's days.
export function canMoveDay(data, dayId, direction) {
  const index = data.days.findIndex((day) => day.id === dayId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= data.days.length) return false;
  return groupOf(data, data.days[index]) === groupOf(data, data.days[target]);
}

export function moveDay(data, dayId, direction) {
  if (!canMoveDay(data, dayId, direction)) return data;
  const index = data.days.findIndex((day) => day.id === dayId);
  const target = index + direction;
  const days = [...data.days];
  [days[index], days[target]] = [days[target], days[index]];
  // A route with dates of its own and no start date to count from: the two days trade dates,
  // so the calendar still runs forward.
  if (!data.plan) {
    const dateOf = (day) => (isDate(day.date) ? { date: day.date, weekday: day.weekday } : { date: undefined, weekday: undefined });
    const [a, b] = [dateOf(days[index]), dateOf(days[target])];
    days[index] = withDate(days[index], b);
    days[target] = withDate(days[target], a);
  }
  // Stages follow the new order of their days.
  const position = new Map(days.map((day, at) => [day.id, at]));
  const stages = (data.stages || []).map((stage) => ({ ...stage, dayIds: [...stage.dayIds].sort((a, b) => position.get(a) - position.get(b)) }));
  return renumberDays({ ...data, days, stages });
}

function withDate(day, { date, weekday }) {
  const { date: _date, weekday: _weekday, ...rest } = day;
  return date ? { ...rest, date, weekday } : rest;
}

// The day number we wrote for a day: dayNumber, or the number in its label ("D0", "D05").
export function numberOf(day) {
  if (Number.isInteger(day.dayNumber)) return day.dayNumber;
  const match = String(day.label || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

const DAY_MENTION = /第\s?(\d+)\s?天/g;
const DROPPED_MENTION = "删掉的那一天";

// After days were added, removed or moved: numbers the days 1, 2, 3 … (a route of ours that starts at
// D0 keeps starting there), gives the visitor's plan its dates from the start date (or none without one),
// and rewrites every "第 N 天" so it still points at the same day. On the visitor's plan the stays,
// the nights in each stage title and the dates line follow the days as they are now.
export function renumberDays(data, removedNumbers = []) {
  const mapping = new Map();
  const removed = new Set(removedNumbers.filter(Number.isInteger));
  const known = data.days.map(numberOf).filter(Number.isInteger);
  const firstNumber = !data.plan && known.length && Math.min(...known) === 0 ? 0 : 1;
  // Our 2026 route writes D0, D1 …; the others D01, D02 ….
  const pad = !data.days.some((day) => /^D\d$/.test(day.label || ""));
  data.days.forEach((day, index) => {
    const old = numberOf(day);
    if (old !== null && !mapping.has(old)) mapping.set(old, index + firstNumber);
  });
  const start = isDate(data.plan?.startDate) ? data.plan.startDate : "";
  const days = data.days.map((day, index) => {
    const number = index + firstNumber;
    const label = `D${pad ? String(number).padStart(2, "0") : number}`;
    if (start) return { ...day, dayNumber: number, label, date: addDays(start, index), weekday: weekdayOf(addDays(start, index)) };
    // The visitor's plan without a start date has no dates; a route of ours keeps the dates its days had.
    if (data.plan) return withDate({ ...day, dayNumber: number, label }, {});
    return { ...day, dayNumber: number, label };
  });
  const rewrite = (text) => text.replace(DAY_MENTION, (whole, digits) => {
    const old = Number(digits);
    if (removed.has(old)) return DROPPED_MENTION;
    return mapping.has(old) ? `第 ${mapping.get(old)} 天` : whole;
  });
  return rewriteTexts({ ...data, days, ...(data.plan?.stops ? planOutline(data, days, start) : {}) }, rewrite);
}

// The parts of the visitor's plan that count days: the dates line, each stage's nights, the stays. A stop
// whose days were all removed leaves the plan: its stage, its place in the route and in the title line.
function planOutline(data, days, start) {
  const nightsAt = (key) => days.filter((day) => day.stopKey === key).length;
  const stopKeys = new Set(data.plan.stops.map((stop) => stop.key));
  // Only when the days name their stops (every plan made since stops had keys does): an older plan's
  // days say nothing either way, and keep the stops they have.
  const counted = days.some((day) => stopKeys.has(day.stopKey));
  const gone = new Set(counted ? [...stopKeys].filter((key) => !nightsAt(key)) : []);
  const stages = (data.stages || [])
    .filter((stage) => !(stage.id.startsWith("stage-") && gone.has(stage.id.slice(6)) && !stage.dayIds.length))
    .map((stage) => {
      const key = stage.id.replace(/^stage-/, "");
      const nights = nightsAt(key);
      return nights && / · \d+ 晚$/.test(stage.title) ? { ...stage, title: stage.title.replace(/ · \d+ 晚$/, ` · ${nights} 晚`) } : stage;
    });
  // Each stop's nights are the days it has now; the route line under the title is written from them.
  const stops = data.plan.stops.filter((stop) => !gone.has(stop.key)).map((stop) => {
    const nights = nightsAt(stop.key);
    return nights && nights !== stop.nights ? { ...stop, nights } : stop;
  });
  const nameOf = (stop) => stages.find((stage) => stage.id === `stage-${stop.key}`)?.title.replace(/ · \d+ 晚$/, "");
  const named = stops.filter((stop) => nightsAt(stop.key));
  const all = named.length > 0 && named.every(nameOf);
  const route = all ? named.map((stop) => `${nameOf(stop)} ${stop.nights} 晚`).join(" → ") : data.trip.route;
  const subtitle = gone.size && all ? named.map(nameOf).join(" · ") : data.trip.subtitle;
  const plan = { ...data.plan, stops };
  if (Array.isArray(data.plan.leftOver)) plan.leftOver = data.plan.leftOver.filter((item) => !gone.has(item.stopKey));
  const out = {
    trip: { ...data.trip, dates: start ? `${monthDay(start)}起 · ${days.length} 天` : `${days.length} 天`, route, ...(subtitle === undefined ? {} : { subtitle }) },
    stages,
    plan,
  };
  if (Array.isArray(data.lodgings)) {
    out.lodgings = data.lodgings.flatMap((row, index) => {
      // Plans saved before the rows named their stop list them in stop order.
      const key = row.stopKey || data.plan.stops[index]?.key;
      const own = days.filter((day) => day.stopKey === key);
      if (!key || !own.length) return [];
      const { checkIn: _in, checkOut: _out, ...rest } = row;
      const first = own[0];
      return [{
        ...rest,
        stopKey: key,
        status: `${own.length} 晚`,
        fromDay: first.dayNumber,
        toDay: first.dayNumber + own.length,
        ...(first.date ? { checkIn: first.date, checkOut: addDays(first.date, own.length) } : {}),
      }];
    });
  }
  return out;
}

// Every visible text, not ids or links.
function rewriteTexts(data, rewrite) {
  const walk = (value, key = "") => {
    if (typeof value === "string") return /url$|^id$|Id$|^date$|^label$/i.test(key) ? value : rewrite(value);
    if (Array.isArray(value)) return value.map((item) => walk(item, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    return value;
  };
  return {
    ...data,
    days: walk(data.days),
    ...(data.todos ? { todos: walk(data.todos) } : {}),
    ...(data.advice ? { advice: walk(data.advice) } : {}),
    ...(data.dining ? { dining: walk(data.dining) } : {}),
  };
}
