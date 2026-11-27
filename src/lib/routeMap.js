// Route maps: hand-drawn sketches for direction only. Coasts, lakes and mountain ranges are public
// geography. Two sheets: New Zealand's South Island, and the east and south-east of Australia.
// A place on the other sheet that you fly to or from sits in a circle at the top.

const nzProject = (lon, lat) => [Number(((lon - 166.55) * 56).toFixed(1)), Number(((-42.35 - lat) * 82 + 150).toFixed(1))];
// Australia a little smaller and higher, so the Great Ocean Road stays clear of the stop card under the map.
const auProject = (lon, lat) => [Number(((lon - 135.5) * 17).toFixed(1)), Number(((-15.5 - lat) * 17 + 24).toFixed(1))];
export const project = nzProject;
const projectAll = (points, to = nzProject) => points.map(([lon, lat]) => to(lon, lat));

const NZ_COAST = [[172.68, -40.5], [173.05, -40.86], [173.28, -41.25], [173.85, -40.86], [174.32, -41.02], [174.27, -41.73], [173.69, -42.42], [173.07, -43.06], [172.74, -43.5], [173.1, -43.8], [172.75, -43.88], [172.3, -43.91], [171.75, -44.1], [171.26, -44.4], [170.98, -45.1], [170.75, -45.86], [169.82, -46.45], [168.85, -46.66], [168.35, -46.62], [168, -46.36], [166.6, -46.16], [166.45, -45.75], [166.85, -45.25], [167.77, -44.58], [168.62, -43.97], [169.04, -43.88], [169.6, -43.6], [170.96, -42.71], [171.2, -42.45], [171.59, -41.75], [172.1, -41.25], [172.1, -40.78]];
const NZ_LAKES = [[[170.53, -43.87], [170.56, -43.93], [170.5, -44.01], [170.46, -44.01], [170.48, -43.93]], [[170.14, -43.93], [170.19, -43.99], [170.2, -44.1], [170.16, -44.19], [170.12, -44.18], [170.12, -44.05]], [[169.85, -44.2], [169.9, -44.27], [169.84, -44.3], [169.8, -44.25]], [[169.13, -44.7], [169.03, -44.66], [169, -44.55], [169.05, -44.45], [169.12, -44.45], [169.1, -44.58], [169.19, -44.66]], [[169.25, -44.62], [169.3, -44.5], [169.34, -44.4], [169.31, -44.39], [169.22, -44.52], [169.2, -44.6]], [[168.4, -44.88], [168.4, -44.95], [168.5, -45.03], [168.66, -45.06], [168.72, -45.1], [168.71, -45.33], [168.65, -45.34], [168.65, -45.13], [168.55, -45.09], [168.34, -44.97], [168.32, -44.88]], [[167.72, -45.4], [167.7, -45.2], [167.8, -45.02], [167.7, -44.92], [167.66, -45.02], [167.6, -45.15], [167.62, -45.4]], [[167.55, -45.55], [167.67, -45.5], [167.65, -45.58], [167.53, -45.62]]];
const NZ_RIDGE = [[172.9, -41.95], [172.3, -42.4], [171.6, -42.95], [171, -43.3], [170.4, -43.58], [170.14, -43.6], [169.6, -44], [169, -44.3], [168.5, -44.55], [168.2, -44.85], [167.9, -45.1], [167.3, -45.5], [167, -45.8]];

// Australia from the Gulf of Carpentaria round Cape York, down the east coast and west along the south coast.
const AU_COAST = [[128, -14.5], [135.4, -14.8], [135.9, -13.3], [136.9, -12.3], [138.6, -16.6], [140.8, -17.5], [141.5, -15.1], [141.6, -12.6], [142.5, -10.7], [143.2, -11.9], [143.5, -13.8], [144.5, -14.2], [145.3, -15.3], [145.46, -16.48], [145.78, -16.92], [146.05, -17.6], [146.1, -18.3], [146.82, -19.26], [147.45, -19.42], [148.25, -20.0], [148.9, -20.4], [149.2, -21.15], [149.6, -22.3], [150.5, -22.6], [150.75, -23.4], [151.25, -23.85], [152.35, -24.87], [152.9, -25.3], [153.1, -26.4], [153.4, -27.4], [153.55, -28.1], [153.64, -28.64], [153.4, -29.4], [153.15, -30.3], [152.92, -31.43], [152.6, -32.2], [151.8, -32.95], [151.25, -33.85], [150.9, -34.4], [150.75, -35.1], [150.2, -35.7], [150.0, -36.6], [149.98, -37.5], [147.98, -37.88], [146.9, -38.5], [146.4, -39.1], [145.5, -38.65], [145.2, -38.55], [144.65, -38.29], [144.33, -38.34], [143.98, -38.54], [143.67, -38.76], [143.51, -38.86], [142.99, -38.62], [142.48, -38.4], [141.6, -38.35], [140.9, -38.05], [139.75, -37.16], [139.2, -36.0], [138.6, -35.6], [138.1, -35.6], [138.45, -35.0], [137.9, -33.6], [137.1, -35.2], [136.6, -35.8], [128, -36]];
const AU_LAKES = [[[144.65, -38.29], [144.42, -38.12], [144.52, -37.95], [144.9, -37.84], [145.1, -38.05], [144.98, -38.3]]];
// The Great Dividing Range, from the tablelands behind Cairns to the Victorian Alps.
const AU_RIDGE = [[145.4, -16.6], [146.3, -19.4], [147.8, -22.0], [149.6, -24.6], [151.2, -27.0], [152.0, -29.6], [151.4, -32.0], [150.3, -33.7], [149.2, -35.4], [148.3, -36.4], [146.9, -37.1], [145.8, -37.5]];

export function smoothPath(points, closed = false) {
  const count = points.length;
  const at = (index) => (closed ? points[(index + count) % count] : points[Math.max(0, Math.min(count - 1, index))]);
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let index = 0; index < (closed ? count : count - 1); index += 1) {
    const [before, from, to, after] = [at(index - 1), at(index), at(index + 1), at(index + 2)];
    path += `C${(from[0] + (to[0] - before[0]) / 6).toFixed(1)},${(from[1] + (to[1] - before[1]) / 6).toFixed(1)} ${(to[0] - (after[0] - from[0]) / 6).toFixed(1)},${(to[1] - (after[1] - from[1]) / 6).toFixed(1)} ${to[0]},${to[1]}`;
  }
  return path + (closed ? "Z" : "");
}

// A fixed sequence, so the little peaks never move between visits.
function snowPeaks(ridgePoints, size = 1) {
  const ridge = ridgePoints;
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let path = "";
  for (let index = 0; index < ridge.length - 1; index += 1) {
    for (let step = 0; step < 5; step += 1) {
      const part = step / 5;
      const x = ridge[index][0] + (ridge[index + 1][0] - ridge[index][0]) * part + (next() - 0.5) * 12;
      const y = ridge[index][1] + (ridge[index + 1][1] - ridge[index][1]) * part + (next() - 0.5) * 10;
      const peak = (3 + next() * 3.5) * size;
      path += `M${(x - peak).toFixed(1)},${(y + peak).toFixed(1)}L${x.toFixed(1)},${(y - peak * 1.2).toFixed(1)}L${(x + peak).toFixed(1)},${(y + peak).toFixed(1)}Z`;
    }
  }
  return path;
}

export const INSETS = { left: [62, 120], right: [330, 120] };

// Each sheet: how to place a [lon, lat], its land, mountains and lakes, and where the corner circles go.
export const SHEETS = {
  nz: {
    name: "新西兰南岛",
    project: nzProject,
    coast: smoothPath(projectAll(NZ_COAST), true),
    ridge: smoothPath(projectAll(NZ_RIDGE)),
    peaks: snowPeaks(projectAll(NZ_RIDGE)),
    lakes: NZ_LAKES.map((lake) => smoothPath(projectAll(lake), true)),
    // Sydney (or wherever in Australia you fly from) on the left, Auckland on the right.
    insets: { other: INSETS.left, north: INSETS.right },
    snow: true,
  },
  au: {
    name: "澳洲东部",
    project: auProject,
    coast: smoothPath(projectAll(AU_COAST, auProject), true),
    ridge: smoothPath(projectAll(AU_RIDGE, auProject)),
    peaks: "",
    lakes: AU_LAKES.map((lake) => smoothPath(projectAll(lake, auProject), true)),
    // New Zealand, when you fly over, in the corner out in the Pacific.
    insets: { other: [336, 104] },
    snow: false,
  },
};

export const mapBase = SHEETS.nz;
const onSheet = ([x, y]) => x > -20 && x < 410 && y > 30 && y < 560;

// Our New Zealand route, from data/nz-overview.json.
export function overviewGeometry(overview) {
  const stops = overview.stops.map((stop) => ({ ...stop, id: stop.key, xy: stop.xy || nzProject(...stop.ll) }));
  const at = (key) => stops.find((stop) => stop.key === key).xy;
  const [chc, zqn] = [at("chc"), at("zqn")];
  return {
    sheet: "nz",
    stops,
    flights: `M${INSETS.left[0]},${INSETS.left[1]} Q170,268 ${chc[0]},${chc[1]} M${zqn[0]},${zqn[1]} Q190,190 ${INSETS.right[0]},${INSETS.right[1]} M${INSETS.right[0]},${INSETS.right[1]} Q372,84 400,62`,
    road: smoothPath(projectAll(overview.road)),
    spurs: overview.spurs.map((spur) => smoothPath(projectAll(spur))).join(" "),
    pins: overview.pins.map((pin) => ({ ...pin, xy: nzProject(...pin.ll) })),
  };
}

const LABELS = [[12, 5, "start"], [-12, -8, "end"], [12, -8, "start"], [-12, 14, "end"]];
const SHEET_WIDTH = 390;
const EDGE = 4;

// About how wide a name is at `size` in a bold sans: Chinese and full-width characters a whole size,
// Latin letters about half to two thirds of it.
export function textWidth(text, size = 16) {
  const em = (char) => {
    if (/[\u2E80-\uFFEF]/.test(char)) return 1;
    if (char === " ") return 0.28;
    if (/[iljtf.,'|!:;()]/.test(char)) return 0.32;
    if (/[mwMW]/.test(char)) return 0.88;
    if (/[A-Z]/.test(char)) return 0.68;
    return 0.58;
  };
  return [...String(text || "")].reduce((sum, char) => sum + em(char) * size, 0);
}

// A label kept on the sheet. A name beside its dot slides in when it is only a little over the edge
// and turns to the dot's other side when sliding would cover the dot; a centred name slides in.
// Sized between the resting (14) and picked (16) type for names beside a dot, at the picked size when centred.
export function fitLabel(xy, label, name) {
  let [dx, dy, anchor] = label;
  const width = textWidth(name, anchor === "middle" ? 16 : 15);
  const span = () => {
    const left = xy[0] + dx - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0);
    return [left, left + width];
  };
  const over = () => {
    const [left, right] = span();
    return Math.max(0, right - (SHEET_WIDTH - EDGE)) - Math.max(0, EDGE - left);
  };
  if (anchor !== "middle" && Math.abs(over()) > Math.abs(dx)) [dx, anchor] = anchor === "start" ? [-Math.abs(dx), "end"] : [Math.abs(dx), "start"];
  dx -= over();
  return [Number(dx.toFixed(1)), dy, anchor];
}

// Which sheets a route needs: one per country with a place we can draw, in the order you get there.
export function sheetsFor(stops) {
  const wanted = [];
  for (const stop of stops) {
    const sheet = stop.country === "au" && stop.ll ? "au" : stop.country === "nz" && (stop.ll || stop.mapXY) ? "nz" : "";
    if (sheet && !wanted.includes(sheet)) wanted.push(sheet);
  }
  return wanted;
}

// A visitor's route on one sheet: its own country's stops where they are (Auckland in its corner on
// the South Island sheet), a place in the other country that you fly to or from in the other corner,
// roads along the way we drove, dashed arcs for flights, a thin straight line for a stretch the
// reference routes never covered. `stops` are { id, placeId, name, country, ll, mapXY, mapLabel, mode, path }.
// The same place twice is one pin with two visits; the corner circle is one pin for every place there.
export function planGeometry(stops, sheet = "nz") {
  const base = SHEETS[sheet];
  const home = sheet === "au" ? "au" : "nz";
  const placeKey = (stop) => stop.placeId || `name:${stop.name}`;
  const spot = (stop, index) => {
    if (stop.country === home) {
      if (sheet === "nz" && stop.mapXY) return { xy: stop.mapXY, label: [0, -14, "middle"] };
      const xy = stop.ll ? base.project(...stop.ll) : null;
      return xy && onSheet(xy) ? { xy, label: stop.mapLabel || null } : null;
    }
    // Another country: only when you fly straight between it and this one.
    const near = [stops[index - 1], stops[index + 1]].some((other) => other?.country === home);
    return near && stop.country ? { xy: base.insets.other, label: [0, -14, "middle"], away: true } : null;
  };
  const placed = [];
  const slot = new Map();
  stops.forEach((stop, index) => {
    const where = spot(stop, index);
    if (!where) return;
    const same = placed.find((item) => item.xy[0] === where.xy[0] && item.xy[1] === where.xy[1] && (where.away || item.placeKey === placeKey(stop)));
    if (same) {
      same.visits.push(stop);
      if (!same.places.includes(stop.name)) same.places.push(stop.name);
      slot.set(stop, same);
      return;
    }
    const entry = { ...stop, placeKey: placeKey(stop), xy: where.xy, away: Boolean(where.away), visits: [stop], places: [stop.name], label: where.label || LABELS[placed.length % LABELS.length] };
    placed.push(entry);
    slot.set(stop, entry);
  });
  let road = "";
  let flights = "";
  let unknown = "";
  for (let index = 1; index < stops.length; index += 1) {
    const a = slot.get(stops[index - 1]);
    const b = slot.get(stops[index]);
    if (!a || !b || a === b) continue;
    const { mode } = stops[index];
    if (mode === "drive" && !a.away && !b.away) {
      road += stops[index].path ? `${smoothPath(projectAll(stops[index].path, base.project))} ` : `M${a.xy[0]},${a.xy[1]} L${b.xy[0]},${b.xy[1]} `;
    } else if (mode !== "flight" && !a.away && !b.away) {
      unknown += `M${a.xy[0]},${a.xy[1]} L${b.xy[0]},${b.xy[1]} `;
    } else {
      const lift = Math.max(30, Math.abs(a.xy[0] - b.xy[0]) * 0.25);
      const mid = [(a.xy[0] + b.xy[0]) / 2 + (a.xy[1] === b.xy[1] ? 0 : 24), (a.xy[1] + b.xy[1]) / 2 - lift / 2];
      flights += `M${a.xy[0]},${a.xy[1]} Q${mid[0].toFixed(1)},${mid[1].toFixed(1)} ${b.xy[0]},${b.xy[1]} `;
    }
  }
  // Pins close together get smaller tap circles, so each dot picks its own stop.
  const nearest = (entry) => Math.min(Infinity, ...placed.filter((other) => other !== entry).map((other) => Math.hypot(other.xy[0] - entry.xy[0], other.xy[1] - entry.xy[1])));
  return {
    sheet,
    stops: placed.map((entry) => {
      const name = entry.away ? `${entry.places.join("、")}（${entry.country === "nz" ? "新西兰" : "澳洲"}）` : entry.name;
      return { ...entry, name, label: fitLabel(entry.xy, entry.label, name), hit: Math.max(8, Math.min(22, nearest(entry) / 2)) };
    }),
    road: road.trim(),
    flights: flights.trim(),
    unknown: unknown.trim(),
    spurs: "",
    pins: [],
    drawn: placed.filter((entry) => !entry.away).length,
    left: stops.filter((stop) => !slot.has(stop) && !(stop.country && stop.country !== home)),
  };
}
