// Fails if anything that looks like a booking number, email or card note is in the published files.
// The full list of our own names and booking numbers lives in the private repository and runs at export time;
// this is the public second line of defence.
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
