// The route form on /plan and the plan it made. The plan can change after it was made (a new first day or
// party size on the plan pages, a file opened from another device), and the form can change on /plan.
// Each field follows the plan unless it was changed on /plan since the form last matched the plan.
import { isDate } from "./dates.js";
import { ImportError, ROUTE_HOME, storageKey } from "./edits.js";
import { knownCountry, knownStopZone } from "./zones.js";

export const DRAFT_KEY = "trip-share:mine:route";
export const DRAFT_FORMAT = "trip-share-route";

export const ROUTE_FIELDS = ["stops", "startDate", "adults", "children", "rooms", "cars", "pace"];

const stopShape = (stop) => ({ key: stop.key || "", placeId: stop.placeId || "", name: stop.name || "", country: stop.country || "", nights: stop.nights });
const same = (field, a, b) => JSON.stringify(field === "stops" ? (a || []).map(stopShape) : a ?? "") === JSON.stringify(field === "stops" ? (b || []).map(stopShape) : b ?? "");

// The form as the plan has it.
export function routeFromPlan(plan, empty) {
  return {
    ...empty,
    startDate: plan.startDate || "",
    adults: plan.adults ?? empty.adults,
    children: plan.children ?? empty.children,
    rooms: plan.rooms ?? empty.rooms,
    cars: plan.cars ?? empty.cars,
    pace: plan.pace === "easy" ? "easy" : "ours",
    stops: (plan.stops || []).map((stop) => ({ ...stop })),
  };
}

export function snapshot(route) {
  return Object.fromEntries(ROUTE_FIELDS.map((field) => [field, field === "stops" ? (route.stops || []).map(stopShape) : route[field] ?? ""]));
}

const whole = (value, min, fallback) => (Number.isInteger(value) && value >= min ? value : fallback);
const plain = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const words = (value) => (typeof value === "string" ? value : "");

// The plan as it was when the form last matched it, or null when the saved one is not in that shape.
function cleanBasis(basis) {
  if (!plain(basis) || !Array.isArray(basis.stops) || !basis.stops.every(plain)) return null;
  return basis;
}

// A saved form with the types the page needs (it may come from an older version or be damaged).
function cleanForm(draft, empty) {
  if (!draft || typeof draft !== "object" || !Array.isArray(draft.stops)) return null;
  return {
    ...empty,
    ...draft,
    startDate: typeof draft.startDate === "string" ? draft.startDate : "",
    adults: whole(draft.adults, 1, empty.adults),
    children: whole(draft.children, 0, empty.children),
    rooms: whole(draft.rooms, 1, empty.rooms),
    cars: whole(draft.cars, 1, empty.cars),
    pace: draft.pace === "easy" ? "easy" : "ours",
    stops: draft.stops
      .filter((stop) => plain(stop) && (words(stop.placeId) || words(stop.name)))
      .map(({ tz, ...stop }, index) => ({
        ...stop,
        key: words(stop.key) || `s-draft-${index}`,
        placeId: words(stop.placeId),
        name: words(stop.name),
        country: knownCountry(stop.country),
        nights: whole(stop.nights, 0, 1),
        ...(knownStopZone(tz) ? { tz } : {}),
      })),
    basis: cleanBasis(draft.basis),
  };
}

// What /plan opens with. `draft` is the saved form (with `basis`: the plan as it was when they last matched).
export function startRoute(draft, plan, empty) {
  const form = cleanForm(draft, empty);
  if (!plan || !Array.isArray(plan.stops)) return form ? { ...form, basis: null } : { ...empty, basis: null };
  const current = routeFromPlan(plan, empty);
  if (!form) return { ...current, basis: snapshot(current) };
  const basis = form.basis;
  const out = { ...form };
  for (const field of ROUTE_FIELDS) {
    const changedHere = basis
      ? !same(field, form[field], basis[field])
      // A form saved before this was tracked: keep its stops when it has any, everything else follows the plan.
      : field === "stops" && form.stops.length > 0;
    out[field] = changedHere ? form[field] : current[field];
  }
  return { ...out, basis: snapshot(current) };
}

// Before /plan replaces the plan: the plan stored now, when it is not the one the visitor already agreed to
// replace (`confirmed`, what this returned last time), so another tab's newer plan is never replaced unasked.
// "" when there is no plan or it is the confirmed one.
export function needsConfirm(storage, confirmed = "") {
  const raw = storage.getItem(storageKey("mine"));
  if (!raw) return "";
  const current = fingerprint(raw);
  return current !== confirmed ? current : "";
}

// A short stand-in for a stored plan (FNV-1a), to tell one saved version from another.
function fingerprint(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}-${hash.toString(36)}`;
}

// A plan made again from the route: the checklist items removed and added, and the budget amounts typed in,
// come along; the days are new.
export function carryOver(previous, next) {
  if (!previous) return next;
  const prep = previous.prep && ((previous.prep.added || []).length || (previous.prep.hidden || []).length) ? { prep: previous.prep } : {};
  const budget = previous.plan?.budget && Object.keys(previous.plan.budget).length ? { budget: previous.plan.budget } : {};
  return { ...next, ...prep, plan: { ...next.plan, ...budget } };
}

// One tab's view of the saved form on /plan. A tab writes only over the form it last read or wrote: when
// another tab saved a newer one in between, `save` leaves it and hands it back (`draft`) instead.
export function draftStore(storage) {
  let seen = null;
  const load = () => {
    seen = storage.getItem(DRAFT_KEY);
    try {
      return JSON.parse(seen || "null");
    } catch {
      return null;
    }
  };
  return {
    load,
    // Whether storage still holds what this tab last read or wrote.
    current: () => storage.getItem(DRAFT_KEY) === seen,
    save(route) {
      if (storage.getItem(DRAFT_KEY) !== seen) return { saved: false, draft: load() };
      const text = JSON.stringify(route);
      storage.setItem(DRAFT_KEY, text);
      seen = text;
      return { saved: true };
    },
  };
}

// The route form as a file of its own (what the error page saves from /plan), opened again on /plan.
export function draftFile(route, now = new Date()) {
  return JSON.stringify({ format: DRAFT_FORMAT, exportedAt: now.toISOString(), route }, null, 2);
}

// Reads a draft file back: the stops in their order with their nights, the first day and the party, and
// the pace. `knownPlace(placeId)` says whether a stop's place is one the site has; a stop that names
// neither a known place nor a place of its own is left out. Throws a message meant for the visitor.
export function readDraftFile(text, empty, knownPlace = () => true) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError("这个文件不是这个网站存的。");
  }
  if (parsed?.format === "trip-share") {
    const home = ROUTE_HOME[parsed.trip] || ROUTE_HOME.mine;
    throw new ImportError(`这是${home.name}存的文件，要到那一页用“打开存的文件”打开。`, { href: home.href, label: home.label });
  }
  const form = cleanForm(parsed?.format === DRAFT_FORMAT ? parsed.route : parsed, empty);
  const keys = new Set();
  const stops = (form?.stops || [])
    .filter((stop) => (stop.placeId ? knownPlace(stop.placeId) : stop.name.trim()))
    .map((stop, index) => {
      const key = keys.has(stop.key) ? `s-file-${index}` : stop.key;
      keys.add(key);
      return { ...stop, key, name: stop.placeId ? "" : stop.name.trim(), nights: Math.min(Math.max(stop.nights, 1), 30) };
    });
  if (!stops.length) throw new ImportError("文件里没有找到排好的路线。");
  return {
    ...empty,
    startDate: isDate(form.startDate) ? form.startDate : "",
    adults: form.adults,
    children: form.children,
    rooms: form.rooms,
    cars: form.cars,
    pace: form.pace,
    stops,
  };
}
