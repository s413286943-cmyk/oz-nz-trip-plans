// Day helpers for the 2026 route page: the timeline by part of day, the map shortcuts and the meals.
const quickResourceTypes = new Set(["map", "booking", "restaurant", "official"]);

function collectTodayResources(day) {
  const seen = new Set();
  const resources = [];

  for (const block of day?.blocks || []) {
    for (const resource of block.resources || []) {
      if (!quickResourceTypes.has(resource.type) || seen.has(resource.id)) continue;
      seen.add(resource.id);
      resources.push(resource);
    }
  }

  return resources;
}

export function buildDayTimeline(day) {
  const slots = [
    { id: "morning", label: "上午", blocks: [] },
    { id: "noon", label: "中午", blocks: [] },
    { id: "afternoon", label: "下午", blocks: [] },
    { id: "night", label: "晚上", blocks: [] },
    { id: "flex", label: "机动 / 备选", blocks: [] },
  ];

  for (const block of day?.blocks || []) {
    if (block.period === "饮食") continue;
    slots.find((slot) => slot.id === classifyTimelineSlot(block))?.blocks.push(block);
  }

  return slots.filter((slot) => slot.blocks.length);
}

export function collectMapActions(day) {
  const resources = collectTodayResources(day);
  const actions = [];
  const lodging = day?.lodgingResource;
  const primary = day?.primaryResource;
  const dinner = findDinnerResource(day);
  const transit = resources.find((resource) => /airport|wharf|ferry|parking|station|机场|码头|停车|车站/i.test(resource.title));

  if (lodging?.type === "map" && day?.lodging && day.lodging !== "-") {
    actions.push({ id: `lodging-${lodging.id}`, label: "打开酒店地图", title: lodging.title, url: lodging.url });
  }
  if (primary?.url && !actions.some((action) => action.url === primary.url)) {
    actions.push({ id: `first-${primary.id}`, label: "打开第一站", title: primary.title, url: primary.url });
  }
  if (dinner) actions.push({ id: `dinner-${dinner.id}`, label: "打开晚餐", title: dinner.title, url: dinner.url });
  if (transit && !actions.some((action) => action.url === transit.url)) {
    actions.push({ id: `transit-${transit.id}`, label: "打开交通点", title: transit.title, url: transit.url });
  }

  return dedupeById(actions).slice(0, 4);
}

export function parseMealPlan(day) {
  const foodBlock = (day?.blocks || []).find((block) => block.period === "饮食");
  const text = foodBlock?.activity || "";
  const meals = {};

  for (const part of text.split(/[；;]/)) {
    const [rawLabel, ...rawValue] = part.split(/[：:]/);
    const label = rawLabel?.trim();
    const value = rawValue.join("：").trim();
    if (!value) continue;
    if (/早餐/.test(label)) meals.breakfast = value;
    if (/午餐/.test(label)) meals.lunch = value;
    if (/晚餐/.test(label)) meals.dinner = value;
  }

  return {
    breakfast: meals.breakfast || "按当天出门节奏就近解决",
    lunch: meals.lunch || "行程中就近轻食",
    dinner: meals.dinner || "看体力和动线决定",
    note: foodBlock?.tip || "餐食按体力和排队情况机动。",
  };
}

function classifyTimelineSlot(block) {
  const text = `${block.period} ${block.place} ${block.activity}`;
  if (/早|上午|出发|抵达|入境/i.test(text)) return "morning";
  if (/午|中午|午餐/i.test(text)) return "noon";
  if (/下午|傍晚/i.test(text)) return "afternoon";
  if (/晚|夜/i.test(text)) return "night";
  return "flex";
}

function findDinnerResource(day) {
  const dinner = parseMealPlan(day).dinner;
  return (day?.blocks || [])
    .flatMap((block) => block.resources || [])
    .find((resource) => resource.type === "restaurant" && resourceTitleMatchesText(resource.title, dinner));
}

function resourceTitleMatchesText(title, text) {
  const normalizedText = normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, "");
  const ignoredWords = new Set(["sydney", "melbourne", "cairns"]);
  const words = String(title || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter((word) => word.length >= 4 && !ignoredWords.has(word));
  return words.length > 0 && words.slice(0, 2).every((word) => normalizedText.includes(word));
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, "");
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
