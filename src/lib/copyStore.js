// One tab's view of a route's saved copy. A tab writes only over the version it last read or wrote;
// when another tab saved in between, `save` hands back that version instead of overwriting it.
import { clearCopy, readCopy, saveCopy, storageKey } from "./edits.js";

export function copyStore(storage, tripId) {
  const key = storageKey(tripId);
  let seen = null;
  const load = () => {
    seen = storage.getItem(key);
    return readCopy(storage, tripId);
  };
  return {
    tripId,
    load,
    save(copy, now = new Date()) {
      if (storage.getItem(key) !== seen) return { saved: false, ...load() };
      saveCopy(storage, tripId, copy.data, copy.baseVersion, now);
      seen = storage.getItem(key);
      return { saved: true };
    },
    clear() {
      clearCopy(storage, tripId);
      seen = null;
    },
  };
}

// The plan a copy was made as: each time /plan lays out the days again, the plan gets a new one.
export const generationOf = (data) => (typeof data?.plan?.generation === "string" ? data.plan.generation : "");

// The changes a tab made since it last saved, done again on the version another tab saved in between,
// so the edit that lost the race is kept rather than dropped. Nothing comes back when the other tab
// cleared the copy (going back to our route was the latest wish), made the plan again from the route
// (`basedOn`: the plan the changes were made on; its days and reminders are not the new plan's), or a
// change cannot be done again.
export function replay(copy, changes, basedOn = generationOf(copy?.data)) {
  if (!copy || !changes.length) return null;
  if (generationOf(copy.data) !== basedOn) return null;
  try {
    return { baseVersion: copy.baseVersion, data: changes.reduce((data, change) => change(data), copy.data) };
  } catch {
    return null;
  }
}

// A file opened from disk: the route and what is kept next to it (ticks, checklist changes) are replaced
// together or not at all. When another tab saved the route since this tab read it, nothing is written and
// that version comes back (`conflict`). When part cannot be written, every key gets its old value back:
// first all of them are emptied, so putting back a larger old value never runs out of room because of
// what was just written. `restored` says whether storage really holds what it held before.
// `sideKeys` are the keys `writeSide(storage)` writes.
export function openWithSide(storage, store, copy, sideKeys, writeSide) {
  const keys = [storageKey(store.tripId), ...sideKeys];
  const before = keys.map((key) => storage.getItem(key));
  try {
    const result = store.save(copy);
    if (!result.saved) return { opened: false, conflict: true, current: result };
    writeSide(storage);
    return { opened: true };
  } catch {
    const attempt = (action) => {
      try {
        action();
      } catch {
        // Checked below.
      }
    };
    keys.forEach((key) => attempt(() => storage.removeItem(key)));
    keys.forEach((key, index) => {
      if (before[index] !== null) attempt(() => storage.setItem(key, before[index]));
    });
    let restored = false;
    attempt(() => {
      restored = keys.every((key, index) => storage.getItem(key) === before[index]);
    });
    let current = null;
    attempt(() => {
      current = store.load();
    });
    return { opened: false, conflict: false, restored, current };
  }
}
