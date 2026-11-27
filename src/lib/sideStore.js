// What a route keeps next to its copy: checklist ticks, and for our reference routes the checklist items
// the visitor removed or added (kept apart so they never freeze the whole route into a copy).
import { cleanChecks, cleanPrep, readCopy, storageKey } from "./edits.js";

export const checksKey = (tripId) => `trip-share:${tripId}:checks`;
export const prepKey = (tripId) => `trip-share:${tripId}:prep`;

function readJson(storage, key) {
  try {
    return JSON.parse(storage?.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function readChecks(storage, tripId) {
  return cleanChecks(readJson(storage, checksKey(tripId)));
}

export function writeChecks(storage, tripId, checks) {
  storage.setItem(checksKey(tripId), JSON.stringify(cleanChecks(checks)));
}

// One tick, on top of what storage holds now: another tab's tick saved a moment ago stays.
export function setCheck(storage, tripId, itemId, done) {
  const { [itemId]: _old, ...rest } = readChecks(storage, tripId);
  const next = done ? { ...rest, [itemId]: true } : rest;
  writeChecks(storage, tripId, next);
  return next;
}

// On our reference routes: the checklist changes kept next to the route. Before any were kept there, an empty
// copy saved by an older site version may still hold them (see readCopy's `leftover`).
export function readPrep(storage, tripId) {
  const own = readJson(storage, prepKey(tripId));
  if (own === null && tripId !== "mine") return cleanPrep(leftoverPrep(storage, tripId));
  return cleanPrep(own);
}

export function writePrep(storage, tripId, prep) {
  storage.setItem(prepKey(tripId), JSON.stringify(cleanPrep(prep)));
}

// One checklist change, made on what storage holds now (as with ticks).
export function changePrep(storage, tripId, change) {
  const next = cleanPrep(change(readPrep(storage, tripId)));
  writePrep(storage, tripId, next);
  return next;
}

function leftoverPrep(storage, tripId) {
  try {
    return readCopy(storage, tripId).leftover?.prep || null;
  } catch {
    return null;
  }
}

// Moves the checklist of an older empty copy next to the route, joined with what is kept there already,
// so a route saved later over that copy does not take the checklist with it. Once it is kept next to the
// route, the empty copy loses its checklist (what else it holds stays): moved once, it does not come back
// after the visitor removes one of its items.
export function adoptLeftover(storage, tripId) {
  if (tripId === "mine") return;
  const prep = leftoverPrep(storage, tripId);
  if (!prep) return;
  const own = readJson(storage, prepKey(tripId));
  writePrep(storage, tripId, own === null ? prep : mergePrep(cleanPrep(own), prep));
  const saved = readJson(storage, storageKey(tripId));
  if (!saved?.data || typeof saved.data !== "object") return;
  const { prep: _moved, ...rest } = saved.data;
  storage.setItem(storageKey(tripId), JSON.stringify({ ...saved, data: rest }));
}

// Removed items from both places (a copy saved by an older version of the site kept them in the copy), added items once.
export function mergePrep(...parts) {
  const hidden = [...new Set(parts.flatMap((part) => part?.hidden || []))];
  const seen = new Set();
  const added = parts.flatMap((part) => part?.added || []).filter((item) => !seen.has(item.id) && seen.add(item.id));
  return { added, hidden };
}

export function emptyPrep(prep) {
  return !prep || (!(prep.added || []).length && !(prep.hidden || []).length);
}

// Ticks after a saved file is opened: a plan file replaces the plan, so its ticks replace the old plan's
// (otherwise the same task in the new plan opens already ticked); on our routes the file's ticks join this device's.
export function checksAfterOpen(current, fromFile, own) {
  return own ? cleanChecks(fromFile) : { ...cleanChecks(current), ...cleanChecks(fromFile) };
}

// What a file opened on a route's page writes next to the route. The route decides, not the button used:
// on the visitor's own plan the file's ticks always replace the old plan's (a file without ticks leaves
// none); on our routes its ticks join this device's and its checklist changes replace the ones kept here.
export function writeOpenedSide(storage, tripId, opened) {
  const own = tripId === "mine";
  const checks = cleanChecks(opened?.checks);
  if (own || Object.keys(checks).length) writeChecks(storage, tripId, checksAfterOpen(readChecks(storage, tripId), checks, own));
  if (!own && opened?.prep) writePrep(storage, tripId, opened.prep);
}
