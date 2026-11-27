// When a page fails to show: which saved copy it reads, so the error page can save it to a file and clear it.
import { exportFile, normalizeTrip, routeOf, storageKey } from "./edits.js";
import { DRAFT_KEY, draftFile } from "./routeDraft.js";

export function routeForPath(pathname = "") {
  if (/^\/nz(\/|$)/.test(pathname)) return "nz";
  if (/^\/au2026(\/|$)/.test(pathname)) return "au2026";
  if (/^\/(mine|plan)(\/|$)/.test(pathname)) return "mine";
  return "";
}

// The keys the page at `pathname` reads its changes from (ticks and weather are left alone: they never break a page).
export function savedKeysFor(pathname = "") {
  const route = routeForPath(pathname);
  if (!route) return [];
  return route === "mine" && /^\/plan(\/|$)/.test(pathname) ? [DRAFT_KEY, storageKey("mine")] : [storageKey(route)];
}

// What a saved copy looks like as a file "打开存的文件" can read again, or "" when nothing is saved.
export function savedAsFile(storage, pathname = "") {
  const route = routeForPath(pathname);
  if (!route) return "";
  const raw = storage?.getItem(storageKey(route));
  if (!raw) return "";
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return raw;
  }
  const data = saved?.data ?? saved;
  // The same file "存成文件" writes, so it is read the same way (route mark included).
  return exportFile(data, fileRoute(saved, data, route), { baseVersion: typeof saved?.baseVersion === "string" ? saved.baseVersion : "" });
}

// The route the saved data really is, not the page it was kept under: a copy saved by this version names
// it (`v: 2`, when that fits what is inside); an older site version could keep one route's data under
// another route's key, and the file has to open on the right page.
function fileRoute(saved, data, pageRoute) {
  const known = ["nz", "au2026", "mine"].includes(saved?.trip);
  const trip = normalizeTrip(data);
  if (saved?.v === 2 && known && (!trip || (saved.trip === "mine") === Array.isArray(trip.plan?.stops))) return saved.trip;
  if (trip) return routeOf(trip);
  return known ? saved.trip : pageRoute;
}

// Every change the page at `pathname` reads, each as its own file to keep: the saved copy (a file
// "打开存的文件" opens again) and, on /plan, the route being laid out. `key` is what clearing it removes.
export function savedFiles(storage, pathname = "") {
  const route = routeForPath(pathname);
  const files = [];
  for (const key of savedKeysFor(pathname)) {
    const raw = storage?.getItem(key);
    if (!raw) continue;
    if (key === DRAFT_KEY) {
      let draft;
      try {
        draft = JSON.parse(raw);
      } catch {
        draft = raw;
      }
      files.push({ key, kind: "draft", name: "排路线-出错时存的.json", text: draftFile(draft) });
    } else {
      files.push({ key, kind: "copy", name: `${route}-行程-出错时存的.json`, text: savedAsFile(storage, pathname) });
    }
  }
  return files;
}
