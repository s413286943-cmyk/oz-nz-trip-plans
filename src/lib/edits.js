// A visitor's own copy of a trip: every change returns a new object, nothing is mutated.
// The copy lives in this browser's localStorage only.

export const MEAL_PERIOD = "饮食";

export function storageKey(tripId) {
  return `trip-share:${tripId}:v1`;
}

export function loadCopy(storage, tripId) {
  try {
    const saved = JSON.parse(storage?.getItem(storageKey(tripId)) || "null");
    if (!saved || !validTrip(saved.data)) return null;
    return { baseVersion: String(saved.baseVersion || ""), savedAt: String(saved.savedAt || ""), data: saved.data };
  } catch {
    return null;
  }
}

export function saveCopy(storage, tripId, data, baseVersion, now = new Date()) {
  storage.setItem(storageKey(tripId), JSON.stringify({ baseVersion, savedAt: now.toISOString(), data }));
}

export function clearCopy(storage, tripId) {
  storage.removeItem(storageKey(tripId));
}

export function validTrip(data) {
  return Boolean(
    data
      && typeof data === "object"
      && data.trip
      && Array.isArray(data.days)
      && data.days.length > 0
      && data.days.every((day) => day && typeof day.id === "string" && Array.isArray(day.blocks)),
  );
}

// Reads a file the visitor exported earlier. Throws a message meant for the visitor.
export function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("这个文件不是导出的行程文件。");
  }
  const data = parsed?.data && validTrip(parsed.data) ? parsed.data : parsed;
  if (!validTrip(data)) throw new Error("文件里没有找到每天的行程。");
  return data;
}

export function exportFile(data, tripId) {
  return JSON.stringify({ format: "trip-share", trip: tripId, exportedAt: new Date().toISOString(), data }, null, 2);
}

function mapDay(data, dayId, change) {
  return { ...data, days: data.days.map((day) => (day.id === dayId ? change(day) : day)) };
}

function renumber(blocks) {
  return blocks.map((block, index) => ({ ...block, sortOrder: (index + 1) * 10 }));
}

export function updateDay(data, dayId, patch) {
  return mapDay(data, dayId, (day) => ({ ...day, ...patch }));
}

export function updateBlock(data, dayId, blockId, patch) {
  return mapDay(data, dayId, (day) => ({
    ...day,
    blocks: day.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)),
  }));
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
    const next = index >= 0 ? [...timeline.slice(0, index + 1), block, ...timeline.slice(index + 1)] : [...timeline, block];
    return { ...day, blocks: renumber([...next, ...meals]) };
  });
}

export function removeBlock(data, dayId, blockId) {
  return mapDay(data, dayId, (day) => ({ ...day, blocks: renumber(day.blocks.filter((block) => block.id !== blockId)) }));
}

export function moveBlock(data, dayId, blockId, direction) {
  return mapDay(data, dayId, (day) => {
    const timeline = day.blocks.filter((block) => block.period !== MEAL_PERIOD);
    const meals = day.blocks.filter((block) => block.period === MEAL_PERIOD);
    const index = timeline.findIndex((block) => block.id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= timeline.length) return day;
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

export function updateNote(data, dayId, index, patch) {
  return mapDay(data, dayId, (day) => ({
    ...day,
    notes: (day.notes || []).map((note, position) => (position === index ? { ...note, ...patch } : note)),
  }));
}

export function addNote(data, dayId) {
  return mapDay(data, dayId, (day) => ({ ...day, notes: [...(day.notes || []), { label: "", text: "" }] }));
}

export function removeNote(data, dayId, index) {
  return mapDay(data, dayId, (day) => ({ ...day, notes: (day.notes || []).filter((_, position) => position !== index) }));
}
