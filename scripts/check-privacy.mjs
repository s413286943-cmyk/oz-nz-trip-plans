// Fails if anything that looks like a booking number, email or card note is in the published files.
// The full list of our own names and booking numbers lives in the private repository and runs at export time;
// this is the public second line of defence. The upcoming trip also must not say when or where we stay.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const scanned = ["data", "content", "src", "README.md", "CLAUDE.md"];
const patterns = [
  [/(确认号|订位号|订单号|预订号|提车确认号)\s*[A-Za-z0-9]{4,}/, "booking number"],
  [/[\w.+-]+@[\w-]+\.(com|net|org|cn|co|nz|au)\b/i, "email address"],
  [/自动扣卡|付订金时留的卡/, "card payment note"],
  [/驾驶人\s*[A-Z]{2,}/, "driver name"],
  [/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, "card number"],
];

const files = scanned.flatMap((entry) => walk(path.join(root, entry)));
const problems = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const [pattern, label] of patterns) {
    const match = text.match(pattern);
    if (match) problems.push(`${path.relative(root, file)}: ${label} (${match[0].slice(0, 2)}…)`);
  }
}

// The upcoming trip is shared without when or where: no later year, dates, weekdays or flight numbers. The full list runs at export time in the private repository.
const upcoming = JSON.parse(readFileSync(path.join(root, "data/nz.json"), "utf8"));
const upcomingText = JSON.stringify(upcoming, (key, value) => (/^(url|imageUrl|coverImageUrl|cityImageUrl)$/.test(key) ? "" : value));
const upcomingPatterns = [
  [/\b20(2[7-9]|[3-9]\d)(?!\d)/, "year after this one"],
  [/\b\d{4}-\d{2}-\d{2}\b/, "date"],
  [/(?<![\d:.])(1[0-2]|0?[1-9])\/([12]\d|3[01]|0?[1-9])(?![\d:])/, "month/day date"],
  [/\d{1,2}\s*月\s*\d{1,2}\s*日/, "date"],
  [/\b(CZ|EK|JQ|NZ|QF|VA|MU|CA|CX)\s?\d{2,4}\b/, "flight number"],
  [/北京时间|公众假期|长周末|补休/, "date hint"],
];
for (const [pattern, label] of upcomingPatterns) {
  const match = upcomingText.match(pattern);
  if (match) problems.push(`data/nz.json: ${label} (${match[0]})`);
}
for (const day of upcoming.days) {
  for (const key of ["date", "weekday", "lat", "lon"]) if (day[key]) problems.push(`data/nz.json: ${day.id} has ${key}`);
}
for (const stay of upcoming.lodgings) {
  for (const key of ["checkIn", "checkOut", "freeCancelUntil"]) if (stay[key]) problems.push(`data/nz.json: stay ${stay.sortOrder} has ${key}`);
}

if (problems.length) {
  console.error(`Possible private data found:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`Privacy check passed (${files.length} files).`);

function walk(target) {
  let stat;
  try {
    stat = statSync(target);
  } catch {
    return [];
  }
  if (stat.isFile()) return /\.(json|md|mjs|js|jsx|css)$/.test(target) ? [target] : [];
  return readdirSync(target).flatMap((name) => walk(path.join(target, name)));
}
