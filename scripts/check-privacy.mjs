// Fails if anything that looks like a booking number, email, phone or card number is in the repository,
// or if a file outside the 2026 route uses a date that is not an obvious example.
// A fuller check runs when the data is exported; this is the public second line of defence.
// `/nz` 按“第 N 天”写，方便读者套到自己的日期；住处写到区域。
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exampleDateProblems, routeWindow } from "./date-literals.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const self = "scripts/check-privacy.mjs";
const BINARY = /\.(jpe?g|png|webp|gif|ico|avif|mp4|mov|webm|woff2?|ttf|otf|pdf|zip)$/i;

const patterns = [
  [/(确认号|订位号|订单号|预订号|提车确认号|预订参考|预订编号|参考号|booking\s*(?:ref(?:erence)?|no\.?|number|code)|confirmation\s*(?:no\.?|number|code)|reservation\s*(?:no\.?|number|code))\s*(?:[:：#＃]|是|为)?\s*[A-Za-z0-9-]{4,}/i, "booking number"],
  [/[\w.+-]+@(?!(?:[\w-]+\.)*(?:example\.(?:invalid|com|org|net)|users\.noreply\.github\.com|noreply\.github\.com)\b)[\w-]+(?:\.[\w-]+)+/i, "email address"],
  // A long number next to a booking word, even with no label of its own ("租车单 88123456").
  [/(?:租车单|租车订单|取车单|取车凭证|取车码|凭证号?|单号|确认码|确认单|订单|预订|订位|确认号|booking|confirmation|reservation|voucher)[^，。；\n\d]{0,8}?\d{6,}/i, "booking number"],
  [/(驾驶人|联系人|入住人|预订人)\s*[:：]?\s*[A-Za-z]{2,}/, "person's name"],
  [/(?<![\d.])(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/, "phone number"],
  [/(?<![A-Za-z0-9])[EeGg]\d{8}(?![A-Za-z0-9])/, "passport number"],
  [/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, "card number"],
];

// The 2026 route is over and published with its dates; everything else uses example dates only.
const ownDates = /^(public\/|package-lock\.json$|data\/au2026|content\/au2026)/;
// Files that hold the New Zealand route, the place library and the method page: no weekdays,
// no clock time tied to the sun, no flight numbers.
const nzFiles = /^(data\/nz[^/]*\.json|data\/places\.json|content\/method\.md)$/;
const nzPatterns = [
  [/(?<![\w.,+-])20[2-9]\d(?![\w]|\.\d)/, "year"],
  [/\b\d{4}-\d{2}-\d{2}\b/, "date"],
  [/(?<![\d:.])(1[0-2]|0?[1-9])\/([12]\d|3[01]|0?[1-9])(?![\d:])/, "month/day date"],
  [/(?<![\d:.])(1[3-9]|2\d|3[01])\/(1[0-2]|0?[1-9])(?![\d:])/, "day/month date"],
  // Day first with a year, as New Zealand and Australia write it (or month first): D/M/YYYY, D-M-YY, D.M.YYYY.
  [/(?<![\w./^~:-])\d{1,2}(?:([/-])\d{1,2}\1(?:19|20)?\d{2}|\.\d{1,2}\.(?:19|20)\d{2})(?![\w.]|[/-]\d)/, "date"],
  [/\d{1,2}\s*月\s*\d{1,2}\s*[日号]/, "date"],
  [/周[一二三四五六日天]|星期[一二三四五六日天]|礼拜[一二三四五六日天]|\b(?:mon|tues|wednes|thurs|fri|satur|sun)days?\b/i, "weekday"],
  [/日落[^，。；\n]{0,6}\d{1,2}[:：]\d{2}|\d{1,2}[:：]\d{2}[^，。；\n]{0,8}日落|sunset[^.,;\n]{0,10}\d{1,2}[:.]\d{2}/i, "sunset time"],
  [/\b(?!SH)[A-Za-z]{2}\s?\d{2,4}\b/, "flight number"],
];

const files = trackedFiles().filter((file) => file !== self && !BINARY.test(file) && file !== "package-lock.json");
const window = routeWindow(JSON.parse(readFileSync(path.join(root, "data/au2026.json"), "utf8")));
const problems = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(path.join(root, file), "utf8");
  } catch {
    continue;
  }
  for (const [pattern, label] of patterns) {
    const match = text.match(pattern);
    if (match) problems.push(`${file}: ${label} (${match[0].slice(0, 2)}…)`);
  }
  if (!ownDates.test(file)) problems.push(...exampleDateProblems(text, window).map((problem) => `${file}: ${problem}`));
  if (nzFiles.test(file)) {
    // Links and the 2026 route's own name are not text a reader sees as a date or a flight.
    const checked = (file.endsWith(".json") ? withoutLinks(text) : text).replace(/\bau2026\b/g, "");
    for (const [pattern, label] of nzPatterns) {
      const match = checked.match(pattern);
      if (match) problems.push(`${file}: ${label} (${match[0]})`);
    }
  }
}

const nzTrip = JSON.parse(readFileSync(path.join(root, "data/nz.json"), "utf8"));
for (const day of nzTrip.days) {
  for (const key of ["date", "weekday", "lat", "lon"]) if (day[key]) problems.push(`data/nz.json: ${day.id} has ${key}`);
}
for (const stay of nzTrip.lodgings) {
  for (const key of ["checkIn", "checkOut", "freeCancelUntil"]) if (stay[key]) problems.push(`data/nz.json: stay ${stay.sortOrder} has ${key}`);
}

if (problems.length) {
  console.error(`Possible private data found:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Privacy check passed (${files.length} files).`);

function withoutLinks(text) {
  return JSON.stringify(JSON.parse(text), (key, value) => (/^(url|imageUrl|coverImageUrl|cityImageUrl)$/.test(key) ? "" : value));
}

// Every file git tracks; outside a checkout, every file but dependencies and build output.
function trackedFiles() {
  try {
    return execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1024 * 1024 * 16 }).split("\0").filter(Boolean);
  } catch {
    return walk("");
  }
}

function walk(relative) {
  const absolute = path.join(root, relative);
  const stat = statSync(absolute);
  if (stat.isFile()) return [relative];
  return readdirSync(absolute)
    .filter((name) => !["node_modules", ".next", ".git", "out"].includes(name))
    .flatMap((name) => walk(relative ? `${relative}/${name}` : name));
}
